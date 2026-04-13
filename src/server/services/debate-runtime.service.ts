import 'server-only';

import { DebateOrchestrator } from '@/lib/orchestration/debate-orchestrator';
import type { OrchestratorContext } from '@/lib/orchestration/debate-orchestrator';
import {
  DEBATE_PHASE_SEQUENCE,
  type DebateParticipantView,
  type DebatePhase,
  type DebateScoreHints,
  type DebateTurnView,
  type DebateWorkspaceSnapshot,
  type SessionCheckpoint,
} from '@/types/domain';
import {
  countTurnsBySession,
  createDebateEvent,
  createRound,
  createTurn,
  getDebateSessionById,
  getRoundBySessionPhase,
  listParticipantsBySession,
  replaceJudgeScores,
  replaceSessionArtifacts,
  updateDebateSession,
  updateParticipant,
  updateRound,
  updateTurn,
} from '@/server/repositories/debate.repository';
import { ensureSessionRun, publishSessionEvent } from '@/server/runtime/session-broker';
import { getDebateWorkspaceService } from '@/server/services/debate.service';
import { resolveManagedLlmProvider } from '@/server/services/model.service';
import { mapTurnView as toTurnView } from '@/server/services/view-mappers';

const STREAM_CHUNK_SIZE = 88;
const STREAM_CHUNK_DELAY_MS = 70;

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isPhase(value: unknown): value is DebatePhase {
  return value === 'opening' || value === 'critique' || value === 'rebuttal' || value === 'final' || value === 'judging' || value === 'closed';
}

function defaultCheckpoint(currentPhase: DebatePhase | null, currentRoundNo: number): SessionCheckpoint {
  return {
    nextPhase: currentPhase && currentPhase !== 'closed' ? currentPhase : 'opening',
    nextParticipantIndex: 0,
    roundNo: currentRoundNo > 0 ? currentRoundNo : 1,
    completedPhases: [],
    processedTurnCount: 0,
  };
}

function parseCheckpoint(value: Record<string, unknown> | null, currentPhase: DebatePhase | null, currentRoundNo: number): SessionCheckpoint {
  if (!value) {
    return defaultCheckpoint(currentPhase, currentRoundNo);
  }

  return {
    nextPhase: isPhase(value.nextPhase) ? value.nextPhase : currentPhase || 'opening',
    nextParticipantIndex: typeof value.nextParticipantIndex === 'number' ? value.nextParticipantIndex : 0,
    roundNo: typeof value.roundNo === 'number' && value.roundNo > 0 ? value.roundNo : currentRoundNo || 1,
    completedPhases: Array.isArray(value.completedPhases) ? value.completedPhases.filter(isPhase) : [],
    processedTurnCount: typeof value.processedTurnCount === 'number' ? value.processedTurnCount : 0,
  };
}

function chunkText(text: string) {
  return text.match(new RegExp(`.{1,${STREAM_CHUNK_SIZE}}`, 'gs')) || [text];
}

function getParticipantTurns(turns: DebateTurnView[], participantId: string) {
  return turns.filter((turn) => turn.participantId === participantId);
}

function getLatestTurn(turns: DebateTurnView[], participantId: string, phase?: DebatePhase) {
  return [...turns]
    .reverse()
    .find((turn) => turn.participantId === participantId && (!phase || turn.phase === phase));
}

function summarizeParticipant(turns: DebateTurnView[], participantId: string, phase?: DebatePhase) {
  return getLatestTurn(turns, participantId, phase)?.summary || '';
}

function summarizeOthers(participants: DebateParticipantView[], currentParticipantId: string) {
  return participants
    .filter((participant) => participant.id !== currentParticipantId)
    .map((participant) => {
      const tags = participant.agent.stanceTags.join('、') || '未设置';
      const description = participant.agent.description || '未填写角色说明';
      const style = participant.agent.stylePrompt || '稳健分析';
      return `- ${participant.agent.name}：${description}；立场标签：${tags}；风格：${style}`;
    })
    .join('\n');
}

function extractFocusPoints(turns: DebateTurnView[]) {
  const points = turns
    .flatMap((turn) => [
      ...turn.structured.claims.map((claim) => claim.text),
      ...turn.structured.attacks.map((attack) => attack.text),
    ])
    .filter(Boolean)
    .slice(-4);

  return points.join('\n');
}

function summarizeOpenings(turns: DebateTurnView[], currentParticipantId: string) {
  return turns
    .filter((turn) => turn.phase === 'opening' && turn.participantId !== currentParticipantId)
    .map((turn) => `- ${turn.agent.name}：${turn.summary}`)
    .join('\n');
}

function summarizeOpponentState(turns: DebateTurnView[], currentParticipantId: string) {
  const latestByOpponent = new Map<string, DebateTurnView>();

  for (const turn of turns) {
    if (turn.participantId === currentParticipantId) continue;
    latestByOpponent.set(turn.participantId, turn);
  }

  return [...latestByOpponent.values()].map((turn) => `- ${turn.agent.name}：${turn.summary}`).join('\n');
}

function attacksAgainstParticipant(turns: DebateTurnView[], participant: DebateParticipantView) {
  return turns
    .flatMap((turn) =>
      turn.structured.attacks
        .filter((attack) => !attack.target_agent || attack.target_agent === participant.agent.name || attack.target_agent === '对手阵营')
        .map((attack) => `- ${turn.agent.name}：${attack.text}`)
    )
    .join('\n');
}

function currentSummary(turns: DebateTurnView[], participantId: string) {
  return getLatestTurn(turns, participantId)?.summary || '';
}

function buildPhaseContext(snapshot: DebateWorkspaceSnapshot, participant: DebateParticipantView, phase: Exclude<DebatePhase, 'judging' | 'closed'>): OrchestratorContext {
  const attachmentsSummary = snapshot.topic.attachments
    .map((attachment) => {
      const excerpt = attachment.extractedText?.slice(0, 500);
      const parseHint = attachment.extractionMethod !== 'none' ? `[${attachment.extractionMethod}/${attachment.extractionStatus}] ` : '';
      return excerpt
        ? `- ${attachment.fileName}：${parseHint}${excerpt}`
        : `- ${attachment.fileName}：${attachment.extractionSummary || `已上传，文件类型 ${attachment.fileType || 'unknown'}`}`;
    })
    .join('\n');

  return {
    topicTitle: snapshot.topic.title,
    topicDescription: snapshot.topic.description,
    extraContext: snapshot.topic.extraContext || undefined,
    attachmentsSummary: attachmentsSummary || undefined,
    agentId: participant.agentId,
    outputRequirements: snapshot.topic.outputRequirements || undefined,
    agentName: participant.agent.name,
    agentDescription: participant.agent.description || undefined,
    stanceTags: participant.agent.stanceTags.join('、') || undefined,
    stylePrompt: participant.agent.stylePrompt || undefined,
    otherAgentsSummary: summarizeOthers(snapshot.participants, participant.id) || undefined,
    selfOpeningSummary: summarizeParticipant(snapshot.turns, participant.id, 'opening') || undefined,
    opponentsOpeningSummary: summarizeOpenings(snapshot.turns, participant.id) || undefined,
    focusPoints: extractFocusPoints(snapshot.turns) || undefined,
    attacksAgainstMe: attacksAgainstParticipant(snapshot.turns, participant) || undefined,
    selfPreviousSummary: summarizeParticipant(snapshot.turns, participant.id) || undefined,
    roundConflictsSummary: extractFocusPoints(snapshot.turns) || undefined,
    selfCurrentSummary: currentSummary(snapshot.turns, participant.id) || undefined,
    opponentsStateSummary: summarizeOpponentState(snapshot.turns, participant.id) || undefined,
  };
}

function collectScoreHints(turns: DebateTurnView[]): DebateScoreHints {
  if (turns.length === 0) {
    return { logic: 0, critique: 0, feasibility: 0, risk: 0, alignment: 0 };
  }

  const sums = turns.reduce(
    (accumulator, turn) => ({
      logic: accumulator.logic + turn.structured.score_hints.logic,
      critique: accumulator.critique + turn.structured.score_hints.critique,
      feasibility: accumulator.feasibility + turn.structured.score_hints.feasibility,
      risk: accumulator.risk + turn.structured.score_hints.risk,
      alignment: accumulator.alignment + turn.structured.score_hints.alignment,
    }),
    { logic: 0, critique: 0, feasibility: 0, risk: 0, alignment: 0 }
  );

  const divisor = turns.length;

  return {
    logic: Number((sums.logic / divisor).toFixed(2)),
    critique: Number((sums.critique / divisor).toFixed(2)),
    feasibility: Number((sums.feasibility / divisor).toFixed(2)),
    risk: Number((sums.risk / divisor).toFixed(2)),
    alignment: Number((sums.alignment / divisor).toFixed(2)),
  };
}

function calculateRepetitionPenalty(turns: DebateTurnView[]) {
  if (turns.length <= 1) {
    return 0;
  }

  const normalized = turns
    .map((turn) => turn.summary.toLowerCase().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const uniqueCount = new Set(normalized).size;
  const duplicateRatio = 1 - uniqueCount / Math.max(normalized.length, 1);

  return Number(Math.min(1.5, duplicateRatio * 1.8).toFixed(2));
}

function calculateResponsiveness(turns: DebateTurnView[]) {
  if (turns.length === 0) {
    return 0;
  }

  const responseTurn = turns.filter((turn) => turn.phase === 'rebuttal' || turn.phase === 'final').length;
  const concessionTurn = turns.reduce((count, turn) => count + turn.structured.concessions.length, 0);
  const attackTurn = turns.reduce((count, turn) => count + turn.structured.attacks.length, 0);
  const base = 5 + responseTurn * 0.8 + Math.min(concessionTurn, 2) * 0.4 + Math.min(attackTurn, 3) * 0.2;

  return Number(Math.min(10, base).toFixed(2));
}

function activeParticipants(participants: DebateParticipantView[]) {
  return participants.filter((participant) => !['conceded', 'stopped', 'errored'].includes(participant.state));
}

async function shouldContinue(sessionId: string) {
  const session = await getDebateSessionById(sessionId);
  if (!session) return false;
  return session.status === 'running';
}

async function finalizeSession(sessionId: string) {
  const orchestrator = new DebateOrchestrator(await resolveManagedLlmProvider({ useCase: 'judge' }));
  const snapshot = await getDebateWorkspaceService(sessionId);
  const participantRows = await listParticipantsBySession(sessionId);
  const judgeContext = {
    topicTitle: snapshot.topic.title,
    topicDescription: snapshot.topic.description,
    participants: snapshot.participants.map((participant) => ({
      agentId: participant.agent.id,
      agentName: participant.agent.name,
      state: participant.state,
      latestSummary: currentSummary(snapshot.turns, participant.id),
      averages: collectScoreHints(getParticipantTurns(snapshot.turns, participant.id)),
      turnCount: getParticipantTurns(snapshot.turns, participant.id).length,
      phaseCoverage: [...new Set(getParticipantTurns(snapshot.turns, participant.id).map((turn) => turn.phase))],
      attackCount: getParticipantTurns(snapshot.turns, participant.id).reduce((count, turn) => count + turn.structured.attacks.length, 0),
      concessionCount: getParticipantTurns(snapshot.turns, participant.id).reduce((count, turn) => count + turn.structured.concessions.length, 0),
      questionCount: getParticipantTurns(snapshot.turns, participant.id).reduce((count, turn) => count + turn.structured.questions.length, 0),
      responsivenessScore: calculateResponsiveness(getParticipantTurns(snapshot.turns, participant.id)),
      repetitionPenalty: calculateRepetitionPenalty(getParticipantTurns(snapshot.turns, participant.id)),
    })),
  };

  const judgeResult = await orchestrator.runJudging(judgeContext);
  const winnerAgentId = judgeResult.data.winner_agent_id;
  const winnerParticipant = snapshot.participants.find((participant) => participant.agent.id === winnerAgentId) || snapshot.participants[0];

  const winnerSummary = await orchestrator.runWinnerSummary({
    topicTitle: snapshot.topic.title,
    winnerAgentId,
    winnerAgentName: winnerParticipant?.agent.name || judgeResult.data.winner_agent_name,
    overallSummary: judgeResult.data.overall_summary,
    decisiveReasons: judgeResult.data.decisive_reasons,
  });

  await replaceJudgeScores(
    sessionId,
    judgeResult.data.score_breakdown
      .map((score) => {
        const participant = participantRows.find((row) => row.agent.id === score.agent_id)?.participant;
        if (!participant) return null;
        return {
          sessionId,
          roundId: null,
          participantId: participant.id,
          logicScore: score.logic_score.toFixed(2),
          critiqueScore: score.critique_score.toFixed(2),
          feasibilityScore: score.feasibility_score.toFixed(2),
          riskScore: score.risk_score.toFixed(2),
          alignmentScore: score.alignment_score.toFixed(2),
          totalScore: score.total_score.toFixed(2),
          explanation: `${score.agent_name} 的综合得分为 ${score.total_score.toFixed(2)}。`,
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
  );

  for (const score of judgeResult.data.score_breakdown) {
    const participant = participantRows.find((row) => row.agent.id === score.agent_id)?.participant;
    if (!participant) continue;
    await updateParticipant(participant.id, {
      totalScore: score.total_score.toFixed(2),
      state: participant.state === 'conceded' ? 'conceded' : 'waiting',
    });
  }

  await replaceSessionArtifacts(sessionId, [
    {
      sessionId,
      artifactType: 'judge_report',
      title: 'Judge Report',
      content: judgeResult.data as unknown as Record<string, unknown>,
    },
    {
      sessionId,
      artifactType: 'winner_report',
      title: 'Winner Summary',
      content: winnerSummary.data as unknown as Record<string, unknown>,
    },
    {
      sessionId,
      artifactType: 'session_summary',
      title: 'Session Summary',
      content: {
        overallSummary: judgeResult.data.overall_summary,
        decisiveReasons: judgeResult.data.decisive_reasons,
      },
    },
    {
      sessionId,
      artifactType: 'argument_map',
      title: 'Argument Map',
      content: {
        claims: snapshot.turns.flatMap((turn) =>
          turn.structured.claims.map((claim) => ({
            agentName: turn.agent.name,
            phase: turn.phase,
            text: claim.text,
          }))
        ),
        attacks: snapshot.turns.flatMap((turn) =>
          turn.structured.attacks.map((attack) => ({
            agentName: turn.agent.name,
            phase: turn.phase,
            text: attack.text,
          }))
        ),
      },
    },
  ]);

  await updateDebateSession(sessionId, {
    status: 'completed',
    completedAt: new Date(),
    currentPhase: 'closed',
    winnerAgentId: winnerParticipant?.agent.id ?? winnerAgentId ?? null,
    summary: judgeResult.data.overall_summary,
    lastCheckpoint: {
      nextPhase: 'closed',
      nextParticipantIndex: 0,
      roundNo: snapshot.session.currentRoundNo,
      completedPhases: [...DEBATE_PHASE_SEQUENCE, 'judging', 'closed'],
      processedTurnCount: snapshot.turns.length,
    },
  });

  await createDebateEvent({
    sessionId,
    eventType: 'JUDGE_SCORED',
    payload: judgeResult.data as unknown as Record<string, unknown>,
  });
  await createDebateEvent({
    sessionId,
    eventType: 'WINNER_DECIDED',
    payload: {
      winnerAgentId: winnerParticipant?.agent.id ?? winnerAgentId ?? null,
      winnerAgentName: winnerParticipant?.agent.name ?? judgeResult.data.winner_agent_name,
    },
  });
  await createDebateEvent({
    sessionId,
    eventType: 'SESSION_COMPLETED',
    payload: {
      summary: judgeResult.data.overall_summary,
      winnerAgentId: winnerParticipant?.agent.id ?? winnerAgentId ?? null,
    },
  });

  const finalSnapshot = await getDebateWorkspaceService(sessionId);
  publishSessionEvent(sessionId, 'SESSION_COMPLETED', {
    snapshot: finalSnapshot,
  });
}

async function executeDebateSession(sessionId: string) {
  const session = await getDebateSessionById(sessionId);
  if (!session || session.status !== 'running') {
    return;
  }

  let checkpoint = parseCheckpoint((session.lastCheckpoint ?? null) as Record<string, unknown> | null, session.currentPhase, session.currentRoundNo);

  if (checkpoint.nextPhase === 'judging') {
    await finalizeSession(sessionId);
    return;
  }

  const startIndex = Math.max(DEBATE_PHASE_SEQUENCE.indexOf((checkpoint.nextPhase as (typeof DEBATE_PHASE_SEQUENCE)[number]) || 'opening'), 0);

  for (let phaseIndex = startIndex; phaseIndex < DEBATE_PHASE_SEQUENCE.length; phaseIndex += 1) {
    const phase = DEBATE_PHASE_SEQUENCE[phaseIndex]!;
    const roundNo = phaseIndex + 1;
    const participantRows = await listParticipantsBySession(sessionId);
    const snapshot = await getDebateWorkspaceService(sessionId);
    const runParticipants = activeParticipants(snapshot.participants);

    if (runParticipants.length === 0) {
      break;
    }

    const round =
      (await getRoundBySessionPhase(sessionId, roundNo, phase)) ||
      (await createRound({
        sessionId,
        roundNo,
        phase,
        status: 'pending',
      }));

    await updateDebateSession(sessionId, {
      currentRoundNo: roundNo,
      currentPhase: phase,
      lastCheckpoint: {
        ...checkpoint,
        nextPhase: phase,
        roundNo,
      },
    });
    await updateRound(round.id, { status: 'running' });
    await createDebateEvent({
      sessionId,
      eventType: 'ROUND_STARTED',
      payload: { phase, roundNo },
    });

    const participantStartIndex = checkpoint.nextPhase === phase ? checkpoint.nextParticipantIndex : 0;
    let phaseShouldStop = false;

    for (let index = participantStartIndex; index < runParticipants.length; index += 1) {
      const stillRunning = await shouldContinue(sessionId);
      if (!stillRunning) {
        await updateDebateSession(sessionId, {
          lastCheckpoint: {
            ...checkpoint,
            nextPhase: phase,
            nextParticipantIndex: index,
            roundNo,
          },
        });
        return;
      }

      const liveSnapshot = await getDebateWorkspaceService(sessionId);
      const participant = liveSnapshot.participants.find((item) => item.id === runParticipants[index]?.id);
      if (!participant || ['conceded', 'stopped', 'errored'].includes(participant.state)) {
        continue;
      }

      const participantRow = participantRows.find((item) => item.participant.id === participant.id);
      if (!participantRow) {
        continue;
      }

      const turnIndex = (await countTurnsBySession(sessionId)) + 1;
      const inputContext = buildPhaseContext(liveSnapshot, participant, phase);
      const turn = await createTurn({
        sessionId,
        roundId: round.id,
        participantId: participant.id,
        turnIndex,
        promptSnapshot: { phase },
        inputContext: inputContext as unknown as Record<string, unknown>,
        streamedText: '',
        finalText: '',
        outputMetadata: {},
        status: 'streaming',
      });

      await updateParticipant(participant.id, { state: 'speaking' });

      const placeholderTurn = toTurnView({
        turn,
        round,
        participant: participantRow.participant,
        agent: participantRow.agent,
      });

      await createDebateEvent({
        sessionId,
        eventType: 'TURN_STARTED',
        payload: {
          turnId: turn.id,
          participantId: participant.id,
          agentId: participant.agent.id,
          agentName: participant.agent.name,
          phase,
        },
      });
      publishSessionEvent(sessionId, 'TURN_STARTED', {
        turn: {
          ...placeholderTurn,
          bubble: {
            title: `${participant.agent.name} · ${phase}`,
            excerpt: `${participant.agent.name} 正在生成本轮发言...`,
          },
          summary: `${participant.agent.name} 正在思考中`,
          text: '',
        },
      });

      const startedAt = Date.now();
      const agentProvider = await resolveManagedLlmProvider({
        modelId: participantRow.agent.modelId,
        useCase: 'agent',
        strictSelection: Boolean(participantRow.agent.modelId),
      });
      const orchestrator = new DebateOrchestrator(agentProvider);
      const execution = await orchestrator.runPhase(phase, inputContext);
      const chunks = chunkText(execution.data.turn.full_markdown);
      let streamedText = '';

      for (const chunk of chunks) {
        streamedText += chunk;
        await createDebateEvent({
          sessionId,
          eventType: 'TURN_STREAM_DELTA',
          payload: {
            turnId: turn.id,
            participantId: participant.id,
            delta: chunk,
          },
        });
        publishSessionEvent(sessionId, 'TURN_STREAM_DELTA', {
          turnId: turn.id,
          delta: chunk,
        });
        await delay(STREAM_CHUNK_DELAY_MS);
      }

      const completedTurn = await updateTurn(turn.id, {
        promptSnapshot: {
          phase,
          systemPrompt: execution.systemPrompt,
          userPrompt: execution.userPrompt,
        },
        inputContext: inputContext as unknown as Record<string, unknown>,
        streamedText,
        finalText: execution.data.turn.full_markdown,
        outputMetadata: execution.data as unknown as Record<string, unknown>,
        tokenInput: execution.usage?.inputTokens,
        tokenOutput: execution.usage?.outputTokens,
        latencyMs: Date.now() - startedAt,
        isConceded: execution.data.control.concede,
        status: 'completed',
      });

      if (!completedTurn) {
        continue;
      }

      await updateParticipant(participant.id, {
        state: execution.data.control.concede ? 'conceded' : 'waiting',
        concedeReason: execution.data.control.concede ? 'Agent主动认输。' : null,
      });

      if (execution.data.control.concede) {
        await createDebateEvent({
          sessionId,
          eventType: 'AGENT_CONCEDED',
          payload: {
            participantId: participant.id,
            agentId: participant.agent.id,
          },
        });
      }

      await createDebateEvent({
        sessionId,
        eventType: 'TURN_COMPLETED',
        payload: {
          turnId: turn.id,
          participantId: participant.id,
          phase,
          summary: execution.data.turn.summary,
          conceded: execution.data.control.concede,
        },
      });

      const completedTurnView = toTurnView({
        turn: completedTurn,
        round,
        participant: participantRow.participant,
        agent: participantRow.agent,
      });
      publishSessionEvent(sessionId, 'TURN_COMPLETED', {
        turn: completedTurnView,
      });

      const afterTurnSnapshot = await getDebateWorkspaceService(sessionId);
      checkpoint = {
        nextPhase: phase,
        nextParticipantIndex: index + 1,
        roundNo,
        completedPhases: checkpoint.completedPhases,
        processedTurnCount: checkpoint.processedTurnCount + 1,
      };

      await updateDebateSession(sessionId, {
        lastCheckpoint: checkpoint,
      });

      if (activeParticipants(afterTurnSnapshot.participants).length <= 1) {
        phaseShouldStop = true;
        break;
      }
    }

    await updateRound(round.id, {
      status: 'completed',
      summary: `Round ${roundNo} (${phase}) completed.`,
    });
    await createDebateEvent({
      sessionId,
      eventType: 'ROUND_COMPLETED',
      payload: { phase, roundNo },
    });

    const nextPhase = DEBATE_PHASE_SEQUENCE[phaseIndex + 1] ?? 'judging';

    checkpoint = {
      nextPhase: phaseShouldStop ? 'judging' : nextPhase,
      nextParticipantIndex: 0,
      roundNo: phaseShouldStop ? roundNo : phaseIndex + 2,
      completedPhases: [...checkpoint.completedPhases.filter((item) => item !== phase), phase],
      processedTurnCount: checkpoint.processedTurnCount,
    };

    await updateDebateSession(sessionId, {
      currentPhase: phaseShouldStop ? 'judging' : nextPhase,
      currentRoundNo: checkpoint.roundNo,
      lastCheckpoint: checkpoint,
    });

    if (phaseShouldStop) {
      break;
    }
  }

  await finalizeSession(sessionId);
}

export function ensureDebateSessionExecution(sessionId: string) {
  return ensureSessionRun(sessionId, async () => {
    try {
      await executeDebateSession(sessionId);
    } catch (error) {
      await updateDebateSession(sessionId, {
        status: 'failed',
      }).catch(() => undefined);

      publishSessionEvent(sessionId, 'SESSION_FAILED', {
        message: error instanceof Error ? error.message : 'Debate execution failed.',
      });
    }
  });
}
