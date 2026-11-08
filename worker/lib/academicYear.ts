/**
 * ปีการศึกษา (พ.ศ.) ตามเวลาไทย: พ.ค.–ธ.ค. = ปี พ.ศ. ปัจจุบัน, ม.ค.–เม.ย. = ปีก่อนหน้า
 */
export function academicYear(now: Date = new Date()): number {
  const th = new Date(now.getTime() + 7 * 60 * 60 * 1000); // UTC+7
  const year = th.getUTCFullYear() + 543;
  return th.getUTCMonth() + 1 >= 5 ? year : year - 1;
}
