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
    firstWeek: "2026-W28"
  },
  WEEKS: {}
};
