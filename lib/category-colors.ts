/** Morandi soft palette — fixed per-category colors for charts & rankings */

export const CATEGORY_COLORS: Record<string, string> = {
  餐饮: "#FB923C",
  购物: "#FACC15",
  交通: "#4ADE80",
  宠物: "#F472B6",
  娱乐: "#38BDF8",
  住房: "#A855F7",
  居住: "#A855F7",
  数码: "#818CF8",
  医疗: "#F87171",
  学习: "#F59E0B",
  丽人: "#EC4899",
  其它支出: "#CBD5E1",
  其它: "#CBD5E1",
  工资: "#34D399",
  理财: "#FBBF24",
  兼职: "#60A5FA",
  奖金: "#A78BFA",
  其它收入: "#94A3B8",
};

const FALLBACK_COLORS = [
  "#FB923C",
  "#FACC15",
  "#4ADE80",
  "#F472B6",
  "#38BDF8",
  "#A855F7",
  "#818CF8",
  "#F87171",
];

/** Resolve a stable, high-contrast color for a category name. */
export function categoryColor(name: string, fallbackIndex = 0): string {
  return (
    CATEGORY_COLORS[name] ??
    FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length]
  );
}
