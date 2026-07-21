/** Morandi soft palette — fixed per-category colors for charts & rankings */

export const CATEGORY_COLORS: Record<string, string> = {
  餐饮: "#FB923C", // 暖橙
  购物: "#FACC15", // 鹅黄
  交通: "#4ADE80", // 薄荷绿
  宠物: "#F472B6", // 樱花粉
  娱乐: "#38BDF8", // 海盐蓝
  居住: "#A855F7", // 薰衣草紫
  住房: "#A855F7",
  数码: "#818CF8", // 靛蓝
  医疗: "#F87171", // 珊瑚红
  其它: "#CBD5E1", // 暖灰
  工资: "#34D399", // 翠绿
  理财: "#FBBF24", // 琥珀
  兼职: "#60A5FA", // 晴空蓝
  其它收入: "#94A3B8", // 烟灰
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
