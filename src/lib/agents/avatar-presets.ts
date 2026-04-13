export type AgentAvatarPreset = {
  id: string;
  name: string;
  imageUrl: string;
  palette: {
    border: string;
    shadow: string;
    leftBubble: string;
    rightBubble: string;
    metaSurface: string;
    avatarShell: string;
    avatarInner: string;
    accentText: string;
    chipBorder: string;
    chipBackground: string;
  };
};

export const AGENT_AVATAR_PRESETS: AgentAvatarPreset[] = [
  {
    id: 'robot-orbit',
    name: '轨道机器人',
    imageUrl: '/avatars/robot-orbit.svg',
    palette: {
      border: 'rgba(103, 232, 249, 0.28)',
      shadow: 'rgba(34, 211, 238, 0.18)',
      leftBubble: 'linear-gradient(160deg, rgba(10, 25, 41, 0.96), rgba(15, 55, 78, 0.92))',
      rightBubble: 'linear-gradient(160deg, rgba(9, 67, 99, 0.96), rgba(56, 189, 248, 0.52))',
      metaSurface: 'rgba(8, 41, 58, 0.55)',
      avatarShell: 'linear-gradient(160deg, rgba(10, 44, 56, 0.92), rgba(19, 90, 119, 0.9))',
      avatarInner: 'rgba(221, 247, 255, 0.98)',
      accentText: '#d9f8ff',
      chipBorder: 'rgba(125, 211, 252, 0.28)',
      chipBackground: 'rgba(125, 211, 252, 0.12)',
    },
  },
  {
    id: 'alien-mint',
    name: '薄荷外星人',
    imageUrl: '/avatars/alien-mint.svg',
    palette: {
      border: 'rgba(74, 222, 128, 0.26)',
      shadow: 'rgba(74, 222, 128, 0.16)',
      leftBubble: 'linear-gradient(160deg, rgba(12, 30, 24, 0.96), rgba(22, 66, 48, 0.92))',
      rightBubble: 'linear-gradient(160deg, rgba(22, 80, 51, 0.96), rgba(74, 222, 128, 0.46))',
      metaSurface: 'rgba(20, 61, 44, 0.54)',
      avatarShell: 'linear-gradient(160deg, rgba(18, 54, 39, 0.94), rgba(33, 103, 72, 0.92))',
      avatarInner: 'rgba(231, 255, 242, 0.98)',
      accentText: '#eafff1',
      chipBorder: 'rgba(134, 239, 172, 0.28)',
      chipBackground: 'rgba(134, 239, 172, 0.12)',
    },
  },
  {
    id: 'fox-ember',
    name: '余烬狐狸',
    imageUrl: '/avatars/fox-ember.svg',
    palette: {
      border: 'rgba(251, 146, 60, 0.28)',
      shadow: 'rgba(251, 146, 60, 0.16)',
      leftBubble: 'linear-gradient(160deg, rgba(43, 21, 14, 0.96), rgba(84, 36, 18, 0.92))',
      rightBubble: 'linear-gradient(160deg, rgba(115, 50, 21, 0.96), rgba(251, 146, 60, 0.44))',
      metaSurface: 'rgba(84, 40, 24, 0.52)',
      avatarShell: 'linear-gradient(160deg, rgba(93, 39, 20, 0.92), rgba(154, 67, 31, 0.92))',
      avatarInner: 'rgba(255, 242, 232, 0.98)',
      accentText: '#fff1e5',
      chipBorder: 'rgba(253, 186, 116, 0.28)',
      chipBackground: 'rgba(253, 186, 116, 0.12)',
    },
  },
  {
    id: 'panda-sage',
    name: '智者熊猫',
    imageUrl: '/avatars/panda-sage.svg',
    palette: {
      border: 'rgba(244, 114, 182, 0.26)',
      shadow: 'rgba(244, 114, 182, 0.16)',
      leftBubble: 'linear-gradient(160deg, rgba(45, 18, 39, 0.96), rgba(79, 29, 65, 0.92))',
      rightBubble: 'linear-gradient(160deg, rgba(111, 33, 87, 0.96), rgba(244, 114, 182, 0.42))',
      metaSurface: 'rgba(79, 29, 65, 0.54)',
      avatarShell: 'linear-gradient(160deg, rgba(68, 29, 67, 0.94), rgba(133, 47, 116, 0.92))',
      avatarInner: 'rgba(255, 239, 247, 0.98)',
      accentText: '#fff0f7',
      chipBorder: 'rgba(249, 168, 212, 0.28)',
      chipBackground: 'rgba(249, 168, 212, 0.12)',
    },
  },
  {
    id: 'owl-indigo',
    name: '靛蓝猫头鹰',
    imageUrl: '/avatars/owl-indigo.svg',
    palette: {
      border: 'rgba(165, 180, 252, 0.28)',
      shadow: 'rgba(129, 140, 248, 0.18)',
      leftBubble: 'linear-gradient(160deg, rgba(22, 25, 57, 0.96), rgba(36, 41, 92, 0.92))',
      rightBubble: 'linear-gradient(160deg, rgba(49, 52, 130, 0.96), rgba(129, 140, 248, 0.44))',
      metaSurface: 'rgba(38, 44, 97, 0.55)',
      avatarShell: 'linear-gradient(160deg, rgba(32, 38, 92, 0.94), rgba(66, 73, 154, 0.92))',
      avatarInner: 'rgba(238, 241, 255, 0.98)',
      accentText: '#eef2ff',
      chipBorder: 'rgba(165, 180, 252, 0.28)',
      chipBackground: 'rgba(165, 180, 252, 0.12)',
    },
  },
  {
    id: 'otter-coral',
    name: '珊瑚水獭',
    imageUrl: '/avatars/otter-coral.svg',
    palette: {
      border: 'rgba(251, 113, 133, 0.28)',
      shadow: 'rgba(251, 113, 133, 0.16)',
      leftBubble: 'linear-gradient(160deg, rgba(48, 17, 27, 0.96), rgba(88, 26, 43, 0.92))',
      rightBubble: 'linear-gradient(160deg, rgba(120, 34, 60, 0.96), rgba(251, 113, 133, 0.42))',
      metaSurface: 'rgba(90, 29, 49, 0.54)',
      avatarShell: 'linear-gradient(160deg, rgba(86, 27, 48, 0.94), rgba(153, 46, 83, 0.92))',
      avatarInner: 'rgba(255, 239, 241, 0.98)',
      accentText: '#fff1f2',
      chipBorder: 'rgba(251, 146, 168, 0.28)',
      chipBackground: 'rgba(251, 146, 168, 0.12)',
    },
  },
];

export const DEFAULT_AGENT_AVATAR_PRESET = AGENT_AVATAR_PRESETS[0]!;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function presetIndexForSeed(seed: string) {
  if (AGENT_AVATAR_PRESETS.length === 0) {
    return 0;
  }

  return hashString(seed) % AGENT_AVATAR_PRESETS.length;
}

export function isKnownAgentAvatarUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  return AGENT_AVATAR_PRESETS.some((preset) => preset.imageUrl === value);
}

export function resolveAgentAvatarPreset(avatarUrl: string | null | undefined, seed: string) {
  const direct = AGENT_AVATAR_PRESETS.find((preset) => preset.imageUrl === avatarUrl);
  if (direct) {
    return direct;
  }

  return AGENT_AVATAR_PRESETS[presetIndexForSeed(seed)] ?? DEFAULT_AGENT_AVATAR_PRESET;
}

export function resolveAgentAvatarUrl(avatarUrl: string | null | undefined, seed: string) {
  return resolveAgentAvatarPreset(avatarUrl, seed).imageUrl;
}

export function pickRandomAgentAvatarUrl() {
  if (AGENT_AVATAR_PRESETS.length === 0) {
    return DEFAULT_AGENT_AVATAR_PRESET.imageUrl;
  }

  const index = Math.floor(Math.random() * AGENT_AVATAR_PRESETS.length);
  return AGENT_AVATAR_PRESETS[index]?.imageUrl ?? DEFAULT_AGENT_AVATAR_PRESET.imageUrl;
}

export function pickNextRandomAgentAvatarUrl(currentAvatarUrl?: string | null) {
  if (AGENT_AVATAR_PRESETS.length <= 1) {
    return DEFAULT_AGENT_AVATAR_PRESET.imageUrl;
  }

  let next = pickRandomAgentAvatarUrl();
  while (next === currentAvatarUrl) {
    next = pickRandomAgentAvatarUrl();
  }

  return next;
}
