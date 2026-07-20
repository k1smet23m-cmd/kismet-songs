/*
 * 手写站点配置。
 * 每周歌曲由 pipeline/ingest.py 自动写入 js/weeks.auto.js；
 * 如需手动补充某一周，也可以在 WEEKS 中按相同结构添加。
 */
window.BLINDBOX_CONFIG = {
  SITE: {
    title: "Kismet Songs",
    subtitle: "给小月亮的专属歌单",
    nickname: "小月亮",
    loveStart: "2026-06-24",
    firstWeek: "2026-W28",
    preopenedWeeks: ["2026-W28", "2026-W29"],
    drawAllowanceRepair: {
      date: "2026-07-20",
      token: "restore-2026-07-20-after-history-import-v1"
    },
    accessHash: "6e849cef492daea3f73886f04243079d9c5ee5d736f13a36cb2c87553f8e934a"
  },
  WEEKS: {}
};
