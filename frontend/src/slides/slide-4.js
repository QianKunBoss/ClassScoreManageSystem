window.slideDataMap.set(4, `
<div class="w-[1440px] h-[810px] shadow-2xl relative overflow-hidden slide-bg" style="font-family: var(--font-body); color:#c2cfe0;">
  <svg class="absolute inset-0 w-full h-full" style="opacity:1;">
    <defs>
      <pattern id="grid4" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#4a7ab5" stroke-width="1" stroke-opacity="0.05"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid4)"/>
  </svg>
  <div class="relative z-10 w-[1350px] h-[720px] mx-auto my-[20px] px-16 py-14 flex flex-col">
    <div class="text-[#8b99b0] font-mono text-[13px] tracking-[0.4em] mb-3">[ CORE FEATURE · 01 ]</div>
    <h2 class="text-[42px] font-bold text-white" style="font-family: var(--font-title);">清晰的多级权限架构</h2>
    <p class="text-[#8b99b0] text-[18px] mt-3">四级星链，层层把控：权限清晰、责任明确，上级统御下级。</p>
    <div class="flex-1 flex items-center justify-center">
      <svg viewBox="0 0 1200 320" class="w-[1080px]" style="max-width:100%;">
        <defs>
          <marker id="ah4" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="#4a7ab5"/></marker>
        </defs>
        <style>
          @keyframes flow4 { to { stroke-dashoffset: -24; } }
          .flow4 { stroke-dasharray: 6 6; animation: flow4 1s linear infinite; }
        </style>
        <path class="flow4" d="M 195 160 L 265 160" stroke="#4a7ab5" stroke-width="2" fill="none" marker-end="url(#ah4)"/>
        <path class="flow4" d="M 435 160 L 505 160" stroke="#4a7ab5" stroke-width="2" fill="none" marker-end="url(#ah4)"/>
        <path class="flow4" d="M 675 160 L 745 160" stroke="#4a7ab5" stroke-width="2" fill="none" marker-end="url(#ah4)"/>
        <path class="flow4" d="M 915 160 L 985 160" stroke="#4a7ab5" stroke-width="2" fill="none" marker-end="url(#ah4)"/>
        <g>
          <rect x="35" y="110" width="160" height="100" rx="12" fill="#0d1525" stroke="#4a7ab5" stroke-width="2"/>
          <text x="115" y="155" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="bold">总系统</text>
          <text x="115" y="182" text-anchor="middle" fill="#8b99b0" font-size="13">SUPER ADMIN</text>
        </g>
        <g>
          <rect x="275" y="110" width="160" height="100" rx="12" fill="#0d1525" stroke="#4a7ab5" stroke-width="2"/>
          <text x="355" y="155" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="bold">学校</text>
          <text x="355" y="182" text-anchor="middle" fill="#8b99b0" font-size="13">SCHOOL</text>
        </g>
        <g>
          <rect x="515" y="110" width="160" height="100" rx="12" fill="#0d1525" stroke="#4a7ab5" stroke-width="2"/>
          <text x="595" y="155" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="bold">年级</text>
          <text x="595" y="182" text-anchor="middle" fill="#8b99b0" font-size="13">GRADE</text>
        </g>
        <g>
          <rect x="755" y="110" width="160" height="100" rx="12" fill="#0d1525" stroke="#4a7ab5" stroke-width="2"/>
          <text x="835" y="155" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="bold">班级</text>
          <text x="835" y="182" text-anchor="middle" fill="#8b99b0" font-size="13">CLASS</text>
        </g>
        <g>
          <rect x="995" y="110" width="160" height="100" rx="12" fill="#4a7ab5" stroke="#c2cfe0" stroke-width="2"/>
          <text x="1075" y="155" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="bold">学生</text>
          <text x="1075" y="182" text-anchor="middle" fill="#eaf1fb" font-size="13">STUDENT</text>
        </g>
      </svg>
    </div>
    <p class="text-center text-[#4a7ab5] font-mono text-[14px] tracking-[0.2em]">权限逐级下放 · 数据逐级汇总</p>
  </div>
</div>
`);
