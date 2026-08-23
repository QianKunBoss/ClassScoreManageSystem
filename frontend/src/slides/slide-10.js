window.slideDataMap.set(10, `
<div class="w-[1440px] h-[810px] shadow-2xl relative overflow-hidden slide-bg" style="font-family: var(--font-body); color:#c2cfe0;">
  <svg class="absolute inset-0 w-full h-full" style="opacity:1;">
    <defs>
      <pattern id="grid10" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#4a7ab5" stroke-width="1" stroke-opacity="0.05"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid10)"/>
  </svg>
  <div class="relative z-10 w-[1350px] h-[720px] mx-auto my-[20px] px-16 py-14 flex flex-col">
    <div class="text-[#8b99b0] font-mono text-[13px] tracking-[0.4em] mb-3">[ WHO USES CSMS ]</div>
    <h2 class="text-[42px] font-bold text-white" style="font-family: var(--font-title);">每个人，都有自己的位置</h2>
    <p class="text-[#8b99b0] text-[18px] mt-3">从学校到班级，从管理者到学生，各取所需。</p>
    <div class="flex-1 flex items-center justify-center">
      <svg viewBox="0 0 1000 460" class="w-[920px]" style="max-width:100%;">
        <g stroke="#4a7ab5" stroke-width="1.5" stroke-opacity="0.55">
          <line x1="500" y1="230" x2="500" y2="80"/>
          <line x1="500" y1="230" x2="190" y2="175"/>
          <line x1="500" y1="230" x2="810" y2="175"/>
          <line x1="500" y1="230" x2="225" y2="385"/>
          <line x1="500" y1="230" x2="775" y2="385"/>
        </g>
        <g>
          <circle cx="500" cy="230" r="58" fill="#4a7ab5"/>
          <text x="500" y="226" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="bold">CSMS</text>
          <text x="500" y="248" text-anchor="middle" fill="#eaf1fb" font-size="12">统一平台</text>
        </g>
        <g>
          <circle cx="500" cy="80" r="50" fill="#0d1525" stroke="#4a7ab5" stroke-width="2"/>
          <text x="500" y="78" text-anchor="middle" fill="#ffffff" font-size="17" font-weight="bold">超级管理员</text>
          <text x="500" y="98" text-anchor="middle" fill="#8b99b0" font-size="12">统筹全局</text>
        </g>
        <g>
          <circle cx="190" cy="175" r="50" fill="#0d1525" stroke="#4a7ab5" stroke-width="2"/>
          <text x="190" y="173" text-anchor="middle" fill="#ffffff" font-size="17" font-weight="bold">学校管理员</text>
          <text x="190" y="193" text-anchor="middle" fill="#8b99b0" font-size="12">建校建级</text>
        </g>
        <g>
          <circle cx="810" cy="175" r="50" fill="#0d1525" stroke="#4a7ab5" stroke-width="2"/>
          <text x="810" y="173" text-anchor="middle" fill="#ffffff" font-size="17" font-weight="bold">年级管理员</text>
          <text x="810" y="193" text-anchor="middle" fill="#8b99b0" font-size="12">年级治理</text>
        </g>
        <g>
          <circle cx="225" cy="385" r="50" fill="#0d1525" stroke="#4a7ab5" stroke-width="2"/>
          <text x="225" y="383" text-anchor="middle" fill="#ffffff" font-size="17" font-weight="bold">班主任</text>
          <text x="225" y="403" text-anchor="middle" fill="#8b99b0" font-size="12">日常管理</text>
        </g>
        <g>
          <circle cx="775" cy="385" r="50" fill="#0d1525" stroke="#4a7ab5" stroke-width="2"/>
          <text x="775" y="383" text-anchor="middle" fill="#ffffff" font-size="17" font-weight="bold">学生</text>
          <text x="775" y="403" text-anchor="middle" fill="#8b99b0" font-size="12">自助查询</text>
        </g>
      </svg>
    </div>
  </div>
</div>
`);
