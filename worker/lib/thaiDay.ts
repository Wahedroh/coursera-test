/** วันที่วันนี้ตามเวลาไทย เป็นนิพจน์ SQL ('YYYY-MM-DD') */
export const TH_DAY = "date('now', '+7 hours')";
/** วันที่ย้อนหลัง n วันตามเวลาไทย เป็นนิพจน์ SQL */
export const TH_DAY_MINUS = (n: number) => `date('now', '+7 hours', '-${Math.floor(n)} days')`;
