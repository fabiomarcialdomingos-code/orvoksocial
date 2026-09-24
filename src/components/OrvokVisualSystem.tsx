import type { CSSProperties, ReactNode } from "react";

type Tone = "gold" | "blue" | "sage" | "violet" | "coral" | "mist";
type Variant = "home" | "radar" | "invite" | "prediction" | "result";
type Vars = CSSProperties & Record<`--${string}`, string | number>;

type Orb = {
  id: string;
  label?: string;
  detail?: string;
  tone: Tone;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  depth?: number;
  slot?: boolean;
  pattern?: boolean;
};

const mapData: Record<Exclude<Variant, "home">, Orb[]> = {
  radar: [
    {
      id: "ana",
      label: "Ana",
      detail: "Visão complementar e inspiradora",
      tone: "blue",
      x: 23,
      y: 28,
      size: 86,
      delay: -1.2,
      duration: 7.4,
    },
    {
      id: "marcos",
      label: "Marcos",
      detail: "Visão prática e realista",
      tone: "gold",
      x: 77,
      y: 28,
      size: 86,
      delay: -3.8,
      duration: 8.1,
    },
    {
      id: "julia",
      label: "Júlia",
      detail: "Visão sensível e humana",
      tone: "sage",
      x: 25,
      y: 73,
      size: 78,
      delay: -5.4,
      duration: 7.1,
    },
    {
      id: "patterns",
      label: "Padrões emergentes",
      detail: "Trajetórias já aparecem",
      tone: "violet",
      x: 77,
      y: 72,
      size: 78,
      delay: -2.5,
      duration: 8.8,
      pattern: true,
    },
  ],
  invite: [
    {
      id: "slot-a",
      tone: "mist",
      x: 50,
      y: 16,
      size: 84,
      delay: -2,
      duration: 7.8,
      slot: true,
    },
    {
      id: "slot-b",
      tone: "mist",
      x: 28,
      y: 73,
      size: 84,
      delay: -4.4,
      duration: 8.6,
      slot: true,
    },
    {
      id: "slot-c",
      tone: "mist",
      x: 72,
      y: 73,
      size: 84,
      delay: -1.1,
      duration: 7.1,
      slot: true,
    },
  ],
  prediction: [
    {
      id: "marcos",
      label: "Marcos",
      detail: "Previsão em andamento",
      tone: "blue",
      x: 71,
      y: 31,
      size: 94,
      delay: -2.9,
      duration: 8.2,
    },
  ],
  result: [
    {
      id: "ana",
      label: "Ana",
      detail: "Visão complementar e inspiradora",
      tone: "blue",
      x: 25,
      y: 25,
      size: 86,
      delay: -1.4,
      duration: 7.8,
    },
    {
      id: "marcos",
      label: "Marcos",
      detail: "Visão prática e realista",
      tone: "gold",
      x: 75,
      y: 25,
      size: 86,
      delay: -3.3,
      duration: 8.4,
    },
    {
      id: "julia",
      label: "Júlia",
      detail: "Visão sensível e humana",
      tone: "sage",
      x: 50,
      y: 78,
      size: 88,
      delay: -5.5,
      duration: 7.2,
    },
  ],
};

const toneColors: Record<Tone, { core: string; edge: string; glow: string }> = {
  gold: { core: "#f2d39b", edge: "#c7974d", glow: "#e8b45d" },
  blue: { core: "#c7e2f4", edge: "#79acd0", glow: "#80c8ef" },
  sage: { core: "#c7e3d1", edge: "#79b395", glow: "#8fd7b2" },
  violet: { core: "#ded8ee", edge: "#a397c4", glow: "#b6a7eb" },
  coral: { core: "#f2cfc5", edge: "#c89082", glow: "#efb1a0" },
  mist: { core: "#eff2f0", edge: "#b5c9ce", glow: "#c6e4eb" },
};

function OrbSvg({
  orb,
  index,
  cx,
  cy,
  gradientId,
  glowId,
}: {
  orb: Orb;
  index: number;
  cx: number;
  cy: number;
  gradientId: string;
  glowId: string;
}) {
  const colors = toneColors[orb.tone];
  return (
    <g
      className={`orvok-svg-orb orvok-svg-orb-${orb.tone}`}
      style={
        {
          "--orb-delay": `${orb.delay}s`,
          "--orb-duration": `${orb.duration}s`,
          "--orb-index": index,
        } as Vars
      }
    >
      <circle
        cx={cx}
        cy={cy}
        r={orb.size * 0.78}
        fill={`url(#${glowId})`}
        opacity=".3"
        filter="url(#softBlur)"
      />
      <circle
        cx={cx}
        cy={cy}
        r={orb.size / 2}
        fill={`url(#${gradientId})`}
        stroke={colors.edge}
        strokeOpacity=".6"
        strokeWidth="1.2"
      />
      <circle
        cx={cx - orb.size * 0.16}
        cy={cy - orb.size * 0.2}
        r={orb.size * 0.13}
        fill="#fff"
        opacity=".78"
        filter="url(#glintBlur)"
      />
      <circle
        cx={cx}
        cy={cy}
        r={orb.size * 0.38}
        fill="none"
        stroke="#fff"
        strokeOpacity=".35"
        strokeWidth="1"
      />
    </g>
  );
}

function OrbDefs({ variant }: { variant: Variant }) {
  const tones = Object.keys(toneColors) as Tone[];
  return (
    <defs>
      <radialGradient id={`${variant}-core`} cx="38%" cy="30%" r="72%">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".28" stopColor="#fffdf4" />
        <stop offset=".58" stopColor="#e9f0ee" />
        <stop offset=".84" stopColor="#d8d9c9" />
        <stop offset="1" stopColor="#b3a77e" stopOpacity=".4" />
      </radialGradient>
      <radialGradient id={`${variant}-center-halo`} cx="42%" cy="34%" r="68%">
        <stop offset="0" stopColor="#fff" stopOpacity=".98" />
        <stop offset=".28" stopColor="#fff8e7" stopOpacity=".8" />
        <stop offset=".58" stopColor="#cfe7e9" stopOpacity=".44" />
        <stop offset="1" stopColor="#d7a35a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${variant}-orbit-cool`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#a9d9f0" stopOpacity="0" />
        <stop offset=".16" stopColor="#a9d9f0" stopOpacity=".42" />
        <stop offset=".44" stopColor="#ffffff" stopOpacity=".17" />
        <stop offset=".72" stopColor="#85c5e7" stopOpacity=".34" />
        <stop offset="1" stopColor="#85c5e7" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${variant}-orbit-warm`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#f0c77a" stopOpacity="0" />
        <stop offset=".21" stopColor="#f0c77a" stopOpacity=".38" />
        <stop offset=".5" stopColor="#fff" stopOpacity=".15" />
        <stop offset=".78" stopColor="#d4a052" stopOpacity=".4" />
        <stop offset="1" stopColor="#d4a052" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${variant}-orbit-sage`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#aed8be" stopOpacity="0" />
        <stop offset=".25" stopColor="#aed8be" stopOpacity=".27" />
        <stop offset=".52" stopColor="#fff" stopOpacity=".12" />
        <stop offset=".8" stopColor="#7ebd9c" stopOpacity=".3" />
        <stop offset="1" stopColor="#7ebd9c" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${variant}-orbit-inner`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".22" stopColor="#fff" stopOpacity=".22" />
        <stop offset=".5" stopColor="#f1d39b" stopOpacity=".23" />
        <stop offset=".82" stopColor="#fff" stopOpacity=".18" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${variant}-filament`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8cc7e7" stopOpacity="0" />
        <stop offset=".24" stopColor="#b8e3f1" stopOpacity=".42" />
        <stop offset=".52" stopColor="#fff" stopOpacity=".2" />
        <stop offset=".75" stopColor="#e2ba70" stopOpacity=".42" />
        <stop offset="1" stopColor="#e2ba70" stopOpacity="0" />
      </linearGradient>
      <linearGradient
        id={`${variant}-filament-sage`}
        x1="0"
        y1="1"
        x2="1"
        y2="0"
      >
        <stop offset="0" stopColor="#9bd3ba" stopOpacity="0" />
        <stop offset=".4" stopColor="#9bd3ba" stopOpacity=".3" />
        <stop offset=".7" stopColor="#fff" stopOpacity=".16" />
        <stop offset="1" stopColor="#80b0d3" stopOpacity="0" />
      </linearGradient>
      <filter id="softBlur">
        <feGaussianBlur stdDeviation="8" />
      </filter>
      <filter id="filamentGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.4" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .55 0"
        />
      </filter>
      <filter id="filamentSoft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <filter id="bigBlur">
        <feGaussianBlur stdDeviation="18" />
      </filter>
      <filter id="glintBlur">
        <feGaussianBlur stdDeviation="2" />
      </filter>
      <filter id="shadow">
        <feDropShadow
          dx="0"
          dy="8"
          stdDeviation="9"
          floodColor="#9b6e37"
          floodOpacity=".16"
        />
      </filter>
      {tones.map((tone) => (
        <g key={tone}>
          <radialGradient id={`${variant}-${tone}`} cx="31%" cy="23%" r="78%">
            <stop offset="0" stopColor="#fff" stopOpacity=".98" />
            <stop offset=".2" stopColor={toneColors[tone].core} />
            <stop offset=".68" stopColor={toneColors[tone].edge} />
            <stop offset="1" stopColor="#fff" stopOpacity=".2" />
          </radialGradient>
          <radialGradient id={`${variant}-${tone}-glow`}>
            <stop
              offset="0"
              stopColor={toneColors[tone].glow}
              stopOpacity=".8"
            />
            <stop
              offset="1"
              stopColor={toneColors[tone].glow}
              stopOpacity="0"
            />
          </radialGradient>
        </g>
      ))}
    </defs>
  );
}

function OrvokFilament({
  d,
  variant,
  tone = "mixed",
  delay = 0,
  duration = 16,
  className = "",
}: {
  d: string;
  variant: Variant;
  tone?: "mixed" | "sage";
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const gradient =
    tone === "sage" ? `${variant}-filament-sage` : `${variant}-filament`;
  return (
    <g
      className={`orvok-filament ${className}`}
      style={
        {
          "--filament-delay": `${delay}s`,
          "--filament-duration": `${duration}s`,
        } as Vars
      }
      aria-hidden="true"
    >
      <path
        pathLength="1"
        className="orvok-filament-atmosphere"
        d={d}
        stroke={`url(#${gradient})`}
      />
      <path
        pathLength="1"
        className="orvok-filament-glow"
        d={d}
        stroke={`url(#${gradient})`}
      />
      <path
        pathLength="1"
        className="orvok-filament-core"
        d={d}
        stroke={`url(#${gradient})`}
      />
      <path
        pathLength="1"
        className="orvok-filament-glint"
        d={d}
        stroke={`url(#${gradient})`}
      />
    </g>
  );
}

function OrvokMicroSpheres({ variant = "home" }: { variant?: Variant }) {
  const particles = [
    [383, 112, 5, "blue", -1.8, 9.8],
    [670, 105, 6, "gold", -4.2, 11.5],
    [813, 170, 4, "blue", -7.5, 13.2],
    [864, 296, 6, "sage", -3.1, 10.4],
    [795, 454, 5, "gold", -8.8, 12.7],
    [597, 503, 7, "blue", -1.2, 14.1],
    [387, 490, 6, "sage", -6.1, 11.8],
    [197, 437, 5, "blue", -10.4, 13.6],
    [136, 306, 6, "gold", -2.4, 10.9],
    [220, 140, 4, "sage", -5.7, 12.3],
    [488, 77, 4, "white", -9.2, 15.2],
    [733, 394, 4, "violet", -4.6, 10.6],
    [332, 339, 4, "gold", -6.8, 12.8],
    [702, 248, 5, "white", -2.9, 14.8],
    [455, 452, 4, "blue", -11.3, 11.2],
    [584, 156, 5, "sage", -7.2, 13.4],
    [301, 256, 3, "white", -1.5, 9.7],
    [755, 114, 3, "gold", -5.2, 12.1],
  ] as const;
  return (
    <g
      className={`orvok-micro-field orvok-micro-field-${variant}`}
      aria-hidden="true"
    >
      {particles.map(([x, y, r, tone, delay, duration], index) => (
        <g
          key={`${x}-${y}`}
          className={`orvok-micro orvok-micro-${tone}`}
          style={
            {
              "--micro-delay": `${delay}s`,
              "--micro-duration": `${duration}s`,
              "--micro-index": index,
            } as Vars
          }
        >
          <circle cx={x} cy={y} r={r * 2.7} className="orvok-micro-halo" />
          <circle cx={x} cy={y} r={r} className="orvok-micro-core" />
          <circle
            cx={x - r * 0.3}
            cy={y - r * 0.35}
            r={Math.max(1.2, r * 0.22)}
            className="orvok-micro-highlight"
          />
        </g>
      ))}
    </g>
  );
}

export function OrvokGlobe({ compact = false }: { compact?: boolean }) {
  const nodes = [
    {
      label: "memória",
      tone: "sage" as Tone,
      x: 540,
      y: 88,
      r: 54,
      delay: -1.4,
    },
    {
      label: "escolhas",
      tone: "blue" as Tone,
      x: 275,
      y: 192,
      r: 52,
      delay: -3.2,
    },
    { label: "você", tone: "gold" as Tone, x: 286, y: 402, r: 48, delay: -2.1 },
    {
      label: "mundo",
      tone: "blue" as Tone,
      x: 792,
      y: 208,
      r: 57,
      delay: -4.4,
    },
    {
      label: "pessoas",
      tone: "violet" as Tone,
      x: 692,
      y: 433,
      r: 48,
      delay: -5.6,
    },
  ];
  return (
    <div
      className={`orvok-globe ${compact ? "orvok-globe-compact" : ""}`}
      role="img"
      aria-label="Esferas luminosas conectadas ao redor do universo ORVOK"
    >
      <svg viewBox="0 0 1080 650" aria-hidden="true" focusable="false">
        <OrbDefs variant="home" />
        <ellipse
          className="orvok-orbit-line orbit-cool"
          stroke="url(#home-orbit-cool)"
          cx="548"
          cy="300"
          rx="440"
          ry="250"
          transform="rotate(4 548 300)"
        />
        <ellipse
          className="orvok-orbit-line orbit-warm"
          stroke="url(#home-orbit-warm)"
          cx="548"
          cy="300"
          rx="366"
          ry="205"
          transform="rotate(-29 548 300)"
        />
        <ellipse
          className="orvok-orbit-line orbit-sage"
          stroke="url(#home-orbit-sage)"
          cx="548"
          cy="300"
          rx="323"
          ry="174"
          transform="rotate(31 548 300)"
        />
        <ellipse
          className="orvok-orbit-line orbit-inner"
          stroke="url(#home-orbit-inner)"
          cx="548"
          cy="300"
          rx="264"
          ry="120"
          transform="rotate(3 548 300)"
        />
        <OrvokFilament
          variant="home"
          d="M84 382 C242 160 504 188 690 304 S891 478 1002 258"
          delay={-2.8}
          duration={18}
          className="filament-back"
        />
        <OrvokFilament
          variant="home"
          tone="sage"
          d="M132 132 C284 286 362 504 590 462 S794 246 954 126"
          delay={-7.1}
          duration={21}
          className="filament-back filament-sage"
        />
        <OrvokFilament
          variant="home"
          d="M126 516 C332 430 390 152 612 132 S830 240 955 466"
          delay={-11.3}
          duration={19}
          className="filament-front"
        />
        <OrvokFilament
          variant="home"
          tone="sage"
          d="M224 82 C428 250 652 352 884 206"
          delay={-4.4}
          duration={24}
          className="filament-front filament-short"
        />
        <circle
          className="orvok-center-glow"
          cx="548"
          cy="300"
          r="168"
          fill="url(#home-center-halo)"
          filter="url(#bigBlur)"
        />
        <circle
          className="orvok-center-glow"
          cx="548"
          cy="300"
          r="122"
          fill="url(#home-center-halo)"
          opacity=".82"
        />
        <path
          className="orvok-center-facet facet-one"
          d="M452 250 Q548 182 644 250 Q610 292 548 300 Q486 292 452 250Z"
        />
        <path
          className="orvok-center-facet facet-two"
          d="M449 353 Q548 420 647 350 Q607 312 548 300 Q487 312 449 353Z"
        />
        <path
          className="orvok-center-facet facet-three"
          d="M482 208 Q548 300 482 391 Q548 420 614 391 Q548 300 614 208Z"
        />
        <circle
          className="orvok-center-core"
          cx="548"
          cy="300"
          r="94"
          fill="url(#home-core)"
          filter="url(#shadow)"
        />
        <circle className="orvok-center-ring" cx="548" cy="300" r="94" />
        <g className="orvok-brand-mark" transform="translate(548 286)">
          <circle cx="-19" cy="-18" r="20" />
          <circle cx="19" cy="-18" r="20" />
          <text x="0" y="43" textAnchor="middle">
            ORVOK
          </text>
        </g>
        <OrvokMicroSpheres />
        {nodes.map((node, index) => {
          const gradientId = `home-${node.tone}`;
          const glowId = `home-${node.tone}-glow`;
          return (
            <g
              key={node.label}
              className="orvok-home-node"
              style={
                {
                  "--orb-delay": `${node.delay}s`,
                  "--orb-duration": `${6.5 + index * 0.55}s`,
                } as Vars
              }
            >
              <OrbSvg
                orb={{
                  id: node.label,
                  tone: node.tone,
                  x: node.x,
                  y: node.y,
                  size: node.r * 2,
                  delay: node.delay,
                  duration: 7,
                }}
                index={index}
                cx={node.x}
                cy={node.y}
                gradientId={gradientId}
                glowId={glowId}
              />
              <text
                className="orvok-home-label"
                x={node.x}
                y={node.y + 5}
                textAnchor="middle"
              >
                {node.label}
              </text>
            </g>
          );
        })}
        {Array.from({ length: 16 }, (_, index) => (
          <circle
            key={index}
            className={`orvok-dust orvok-dust-${index % 5}`}
            cx={150 + ((index * 137) % 780)}
            cy={55 + ((index * 91) % 500)}
            r={index % 3 === 0 ? 5 : 3}
          />
        ))}
      </svg>
    </div>
  );
}

export function OrvokOrbitMap({
  variant,
  label,
}: {
  variant: Exclude<Variant, "home">;
  label: string;
}) {
  const nodes = mapData[variant];
  const center = { x: 500, y: 300 };
  const centerRadius = variant === "invite" ? 62 : 72;
  return (
    <div
      className={`orvok-orbit-map orvok-orbit-map-${variant}`}
      role="img"
      aria-label={label}
    >
      <div className="orvok-map-wash orvok-map-wash-cool" />
      <div className="orvok-map-wash orvok-map-wash-warm" />
      <svg viewBox="0 0 1000 600" aria-hidden="true" focusable="false">
        <OrbDefs variant={variant} />
        <ellipse
          className="orvok-map-orbit orbit-cool"
          stroke={`url(#${variant}-orbit-cool)`}
          cx="500"
          cy="300"
          rx="350"
          ry="220"
          transform="rotate(1 500 300)"
        />
        <ellipse
          className="orvok-map-orbit orbit-warm"
          stroke={`url(#${variant}-orbit-warm)`}
          cx="500"
          cy="300"
          rx="268"
          ry="188"
          transform="rotate(-34 500 300)"
        />
        <ellipse
          className="orvok-map-orbit orbit-sage"
          stroke={`url(#${variant}-orbit-sage)`}
          cx="500"
          cy="300"
          rx="220"
          ry="286"
          transform="rotate(35 500 300)"
        />
        <ellipse
          className="orvok-map-orbit orbit-inner"
          stroke={`url(#${variant}-orbit-inner)`}
          cx="500"
          cy="300"
          rx="155"
          ry="116"
        />
        {nodes.map((node, index) => {
          const x = node.x * 10;
          const y = node.y * 6;
          return (
            <g key={node.id}>
              <OrvokFilament
                variant={variant}
                tone={index % 2 === 0 ? "mixed" : "sage"}
                delay={-index * 2.2}
                duration={15 + index * 2.4}
                d={`M ${center.x - 8} ${center.y + (index % 2 ? 9 : -7)} C ${center.x + (x - center.x) * 0.18} ${center.y + (index % 2 ? 78 : -74)}, ${center.x + (x - center.x) * 0.72} ${y + (index % 2 ? -52 : 52)}, ${x} ${y}`}
                className={
                  index % 2 ? "filament-map-sage" : "filament-map-mixed"
                }
              />
              <circle
                className="orvok-map-particle"
                cx={(center.x + x) / 2 + (index * 19 - 21)}
                cy={(center.y + y) / 2 - 12}
                r="4"
              />
              <OrbSvg
                orb={node}
                index={index}
                cx={x}
                cy={y}
                gradientId={`${variant}-${node.tone}`}
                glowId={`${variant}-${node.tone}-glow`}
              />
            </g>
          );
        })}
        <circle
          className="orvok-map-center-halo"
          cx={center.x}
          cy={center.y}
          r={centerRadius * 1.9}
          fill={`url(#${variant}-center-halo)`}
          filter="url(#bigBlur)"
        />
        <circle
          className="orvok-map-center"
          cx={center.x}
          cy={center.y}
          r={centerRadius}
          fill={`url(#${variant}-core)`}
          filter="url(#shadow)"
        />
        <circle
          className="orvok-map-center-ring"
          cx={center.x}
          cy={center.y}
          r={centerRadius}
        />
        <g
          className="orvok-map-person"
          transform={`translate(${center.x} ${center.y - 3})`}
        >
          <circle cx="0" cy="-17" r="15" />
          <path d="M-27 26C-25 2 25 2 27 26" />
          <text x="0" y="52" textAnchor="middle">
            VOCÊ
          </text>
        </g>
        {Array.from({ length: 14 }, (_, index) => (
          <circle
            key={index}
            className={`orvok-map-dust orvok-map-dust-${index % 5}`}
            cx={80 + ((index * 149) % 840)}
            cy={42 + ((index * 83) % 500)}
            r={index % 4 === 0 ? 5 : 3}
          />
        ))}
      </svg>
      <div className="orvok-map-labels">
        {nodes
          .filter((node) => node.label)
          .map((node) => (
            <div
              key={node.id}
              className={`orvok-map-label orvok-map-label-${node.tone}`}
              style={
                {
                  "--label-x": `${node.x}%`,
                  "--label-y": `${node.y}%`,
                  "--label-offset": node.x > 55 ? "18px" : "-18px",
                } as Vars
              }
            >
              <strong>{node.label}</strong>
              <span>{node.detail}</span>
            </div>
          ))}
      </div>
      {nodes
        .filter((node) => node.slot)
        .map((node) => (
          <span
            key={node.id}
            className="orvok-slot-label"
            style={
              { "--label-x": `${node.x}%`, "--label-y": `${node.y}%` } as Vars
            }
          >
            +
          </span>
        ))}
    </div>
  );
}

export function OrvokPillIcon({
  tone = "gold",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span className={`orvok-pill-icon orvok-pill-icon-${tone}`}>
      {children}
    </span>
  );
}
