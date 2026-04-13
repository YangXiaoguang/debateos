CREATE TYPE "public"."agent_status" AS ENUM('active', 'archived', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('winner_report', 'judge_report', 'argument_map', 'session_summary', 'export_json', 'export_markdown');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('TOPIC_CREATED', 'AGENT_SELECTED', 'DEBATE_STARTED', 'ROUND_STARTED', 'TURN_STARTED', 'TURN_STREAM_DELTA', 'TURN_COMPLETED', 'AGENT_CONCEDED', 'ROUND_COMPLETED', 'SESSION_PAUSED', 'SESSION_RESUMED', 'SESSION_ABORTED', 'JUDGE_SCORED', 'WINNER_DECIDED', 'SESSION_COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."participant_state" AS ENUM('pending', 'active', 'speaking', 'waiting', 'conceded', 'stopped', 'errored');--> statement-breakpoint
CREATE TYPE "public"."round_phase" AS ENUM('opening', 'critique', 'rebuttal', 'final', 'judging', 'closed');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('draft', 'ready', 'running', 'paused', 'completed', 'aborted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."topic_mode" AS ENUM('hybrid', 'knockout', 'score', 'synthesis');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('draft', 'ready', 'archived');--> statement-breakpoint
CREATE TYPE "public"."turn_status" AS ENUM('pending', 'streaming', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."winner_rule" AS ENUM('hybrid', 'last_active', 'judge_score', 'user_vote');--> statement-breakpoint
CREATE TABLE "agent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"avatar_url" text,
	"model_id" uuid,
	"system_prompt" text NOT NULL,
	"style_prompt" text,
	"stance_tags" jsonb,
	"capabilities" jsonb,
	"temperature" numeric(3, 2) DEFAULT '0.70',
	"max_tokens" integer,
	"status" "agent_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" "event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"agent_version_id" uuid,
	"seat_order" integer NOT NULL,
	"state" "participant_state" DEFAULT 'pending' NOT NULL,
	"is_random_selected" boolean DEFAULT false NOT NULL,
	"concede_reason" text,
	"total_score" numeric(6, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"round_no" integer NOT NULL,
	"phase" "round_phase" NOT NULL,
	"status" "round_status" DEFAULT 'pending' NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"status" "session_status" DEFAULT 'draft' NOT NULL,
	"current_round_no" integer DEFAULT 0 NOT NULL,
	"current_phase" "round_phase",
	"winner_agent_id" uuid,
	"started_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"aborted_at" timestamp with time zone,
	"last_checkpoint" jsonb,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"turn_index" integer NOT NULL,
	"prompt_snapshot" jsonb,
	"input_context" jsonb,
	"streamed_text" text,
	"final_text" text,
	"output_metadata" jsonb,
	"token_input" integer,
	"token_output" integer,
	"latency_ms" integer,
	"is_conceded" boolean DEFAULT false NOT NULL,
	"status" "turn_status" DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judge_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"round_id" uuid,
	"participant_id" uuid NOT NULL,
	"logic_score" numeric(5, 2),
	"critique_score" numeric(5, 2),
	"feasibility_score" numeric(5, 2),
	"risk_score" numeric(5, 2),
	"alignment_score" numeric(5, 2),
	"total_score" numeric(6, 2),
	"explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"turn_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"artifact_type" "artifact_type" NOT NULL,
	"title" varchar(255),
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model_name" varchar(120) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(100),
	"file_size" integer,
	"file_url" text NOT NULL,
	"extracted_text" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"extra_context" text,
	"mode" "topic_mode" DEFAULT 'hybrid' NOT NULL,
	"max_rounds" integer DEFAULT 3 NOT NULL,
	"output_requirements" text,
	"winner_rule" "winner_rule" DEFAULT 'hybrid' NOT NULL,
	"metadata" jsonb,
	"status" "topic_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100),
	"avatar_url" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_model_id_system_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."system_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_events" ADD CONSTRAINT "debate_events_session_id_debate_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_events" ADD CONSTRAINT "debate_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_session_id_debate_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_agent_version_id_agent_versions_id_fk" FOREIGN KEY ("agent_version_id") REFERENCES "public"."agent_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_rounds" ADD CONSTRAINT "debate_rounds_session_id_debate_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_sessions" ADD CONSTRAINT "debate_sessions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_sessions" ADD CONSTRAINT "debate_sessions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_sessions" ADD CONSTRAINT "debate_sessions_winner_agent_id_agents_id_fk" FOREIGN KEY ("winner_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_turns" ADD CONSTRAINT "debate_turns_session_id_debate_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_turns" ADD CONSTRAINT "debate_turns_round_id_debate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."debate_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_turns" ADD CONSTRAINT "debate_turns_participant_id_debate_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."debate_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_scores" ADD CONSTRAINT "judge_scores_session_id_debate_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_scores" ADD CONSTRAINT "judge_scores_round_id_debate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."debate_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_scores" ADD CONSTRAINT "judge_scores_participant_id_debate_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."debate_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_favorites" ADD CONSTRAINT "message_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_favorites" ADD CONSTRAINT "message_favorites_turn_id_debate_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."debate_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_artifacts" ADD CONSTRAINT "session_artifacts_session_id_debate_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_attachments" ADD CONSTRAINT "topic_attachments_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_versions_agent_version_uq" ON "agent_versions" USING btree ("agent_id","version_no");--> statement-breakpoint
CREATE INDEX "agents_owner_idx" ON "agents" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "debate_participants_session_agent_uq" ON "debate_participants" USING btree ("session_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "debate_rounds_session_round_phase_uq" ON "debate_rounds" USING btree ("session_id","round_no","phase");--> statement-breakpoint
CREATE INDEX "debate_sessions_owner_idx" ON "debate_sessions" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "debate_sessions_status_idx" ON "debate_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "debate_sessions_topic_idx" ON "debate_sessions" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_favorites_user_turn_uq" ON "message_favorites" USING btree ("user_id","turn_id");--> statement-breakpoint
CREATE INDEX "topic_attachments_topic_idx" ON "topic_attachments" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");