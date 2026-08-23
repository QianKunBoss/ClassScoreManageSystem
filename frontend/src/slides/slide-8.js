window.slideDataMap.set(8, `
<div class="w-[1440px] h-[810px] shadow-2xl relative overflow-hidden slide-bg" style="font-family: var(--font-body); color:#c2cfe0;">
  <svg class="absolute inset-0 w-full h-full" style="opacity:1;">
    <defs>
      <pattern id="grid8" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#4a7ab5" stroke-width="1" stroke-opacity="0.05"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid8)"/>
  </svg>
  <div class="relative z-10 w-[1350px] h-[720px] mx-auto my-[20px] px-16 py-14 flex flex-col">
    <div class="text-[#8b99b0] font-mono text-[13px] tracking-[0.4em] mb-3">[ CORE FEATURE · 05 ]</div>
    <h2 class="text-[42px] font-bold text-white" style="font-family: var(--font-title);">数据统计</h2>
    <p class="text-[#8b99b0] text-[18px] mt-3">多维度扫描班级态势，趋势一目了然。</p>
    <div class="grid grid-cols-2 gap-10 mt-12 items-stretch flex-1">
      <div class="grid grid-cols-2 gap-5">
        <div class="rounded-xl border border-[#4a7ab5]/25 p-6" style="background:rgba(13,21,37,0.6); box-shadow:0 8px 30px rgba(74,122,181,0.06);">
          <h3 class="text-[19px] font-bold text-white mb-2">多维度扫描</h3>
          <p class="text-[#8b99b0] text-[15px] leading-relaxed">按人、按组、按时间灵活切片。</p>
        </div>
        <div class="rounded-xl border border-[#4a7ab5]/25 p-6" style="background:rgba(13,21,37,0.6); box-shadow:0 8px 30px rgba(74,122,181,0.06);">
          <h3 class="text-[19px] font-bold text-white mb-2">趋势图表</h3>
          <p class="text-[#8b99b0] text-[15px] leading-relaxed">积分走势直观呈现，拐点可见。</p>
        </div>
        <div class="rounded-xl border border-[#4a7ab5]/25 p-6" style="background:rgba(13,21,37,0.6); box-shadow:0 8px 30px rgba(74,122,181,0.06);">
          <h3 class="text-[19px] font-bold text-white mb-2">整体态势</h3>
          <p class="text-[#8b99b0] text-[15px] leading-relaxed">班级全貌一屏掌握，不漏细节。</p>
        </div>
        <div class="rounded-xl border border-[#4a7ab5]/25 p-6" style="background:rgba(13,21,37,0.6); box-shadow:0 8px 30px rgba(74,122,181,0.06);">
          <h3 class="text-[19px] font-bold text-white mb-2">辅助决策</h3>
          <p class="text-[#8b99b0] text-[15px] leading-relaxed">数据支撑评优与干预策略。</p>
        </div>
      </div>
      <div class="rounded-xl border border-[#4a7ab5]/25 p-8 flex flex-col justify-center" style="background:rgba(13,21,37,0.6); box-shadow:0 8px 30px rgba(74,122,181,0.06);">
        <svg viewBox="0 0 320 220" width="100%" height="240">
          <g fill="#4a7ab5">
            <rect x="30" y="120" width="36" height="70" rx="3"/>
            <rect x="90" y="80" width="36" height="110" rx="3" fill="#8b99b0"/>
            <rect x="150" y="140" width="36" height="50" rx="3"/>
            <rect x="210" y="50" width="36" height="140" rx="3" fill="#8b99b0"/>
            <rect x="270" y="100" width="36" height="90" rx="3"/>
          </g>
          <line x1="20" y1="195" x2="320" y2="195" stroke="#4a7ab5" stroke-width="1.5" stroke-opacity="0.5"/>
          <g fill="#8b99b0" font-size="12" text-anchor="middle">
            <text x="48" y="212">9月</text><text x="108" y="212">10月</text><text x="168" y="212">11月</text><text x="228" y="212">12月</text><text x="288" y="212">1月</text>
          </g>
        </svg>
        <p class="text-center text-[#8b99b0] text-[14px] mt-3 font-mono tracking-wider">MONTHLY SCORE TREND</p>
      </div>
    </div>
  </div>
</div>
`);
