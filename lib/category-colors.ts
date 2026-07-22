/** Morandi low-saturation palette — charts & list icon tones */

export type CategoryTone = { bg: string; fg: string; chart: string };

export const CATEGORY_TONES: Record<string, CategoryTone> = {
  餐饮: { bg: "#F2ECE4", fg: "#8C7A6B", chart: "#C4A484" },
  购物: { bg: "#EFEAE8", fg: "#8A6A64", chart: "#B89A90" },
  交通: { bg: "#E8EFE9", fg: "#5B7A66", chart: "#7A9A85" },
  宠物: { bg: "#EFEAE8", fg: "#8A6A64", chart: "#B89A90" },
  娱乐: { bg: "#EAE8EF", fg: "#6B6580", chart: "#8A8498" },
  住房: { bg: "#F2ECE4", fg: "#8C7A6B", chart: "#A89078" },
  居住: { bg: "#F2ECE4", fg: "#8C7A6B", chart: "#A89078" },
  数码: { bg: "#E8ECEF", fg: "#5A6A78", chart: "#7A8A98" },
  医疗: { bg: "#EFEAE8", fg: "#8A6A64", chart: "#B07068" },
  学习: { bg: "#F2ECE4", fg: "#8C7A6B", chart: "#B8A070" },
  丽人: { bg: "#EFE8EC", fg: "#8A6A78", chart: "#A88898" },
  其它支出: { bg: "#F0ECE1", fg: "#9C9285", chart: "#A8A090" },
  其它: { bg: "#F0ECE1", fg: "#9C9285", chart: "#A8A090" },
  工资: { bg: "#E8EFE9", fg: "#5B7A66", chart: "#6B8F71" },
  理财: { bg: "#F2ECE4", fg: "#8C7A6B", chart: "#B8A070" },
  兼职: { bg: "#E8ECEF", fg: "#5A6A78", chart: "#7A8A98" },
  奖金: { bg: "#EFE8EC", fg: "#8A6A78", chart: "#A88898" },
  其它收入: { bg: "#E8EFE9", fg: "#5B7A66", chart: "#7A9A85" },
};

const FALLBACK_TONES: CategoryTone[] = [
  { bg: "#F2ECE4", fg: "#8C7A6B", chart: "#C4A484" },
  { bg: "#E8EFE9", fg: "#5B7A66", chart: "#7A9A85" },
  { bg: "#EFEAE8", fg: "#8A6A64", chart: "#B89A90" },
  { bg: "#E8ECEF", fg: "#5A6A78", chart: "#7A8A98" },
  { bg: "#EAE8EF", fg: "#6B6580", chart: "#8A8498" },
  { bg: "#F0ECE1", fg: "#9C9285", chart: "#A8A090" },
];

export function categoryTone(
  name: string,
  fallbackIndex = 0,
): CategoryTone {
  return (
    CATEGORY_TONES[name] ??
    FALLBACK_TONES[fallbackIndex % FALLBACK_TONES.length]
  );
}

/** Chart fill color (Morandi solid). */
export function categoryColor(name: string, fallbackIndex = 0): string {
  return categoryTone(name, fallbackIndex).chart;
}

/** List icon slot style. */
export function categoryIconStyle(
  name: string,
  fallbackIndex = 0,
): { backgroundColor: string; color: string } {
  const tone = categoryTone(name, fallbackIndex);
  return { backgroundColor: tone.bg, color: tone.fg };
}
