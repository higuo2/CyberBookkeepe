import {
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Cat,
  Coins,
  Film,
  Gift,
  HeartPulse,
  Home,
  Laptop,
  LayoutGrid,
  Package,
  Shapes,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Utensils,
} from "lucide-react";

export function CategoryIcon({
  category,
  className = "size-4",
  strokeWidth = 2,
}: {
  category: string;
  className?: string;
  strokeWidth?: number;
}) {
  const props = { className, strokeWidth, "aria-hidden": true as const };

  if (category === "ALL" || category.includes("全部")) {
    return <LayoutGrid {...props} />;
  }
  if (category.includes("餐")) return <Utensils {...props} />;
  if (category.includes("交通")) return <Bus {...props} />;
  if (category.includes("购物")) return <ShoppingBag {...props} />;
  if (
    category.includes("居住") ||
    category.includes("住房") ||
    category.includes("房")
  ) {
    return <Home {...props} />;
  }
  if (category.includes("数码")) return <Laptop {...props} />;
  if (category.includes("医疗") || category.includes("健康")) {
    return <HeartPulse {...props} />;
  }
  if (category.includes("娱乐")) return <Film {...props} />;
  if (category.includes("宠物")) return <Cat {...props} />;
  if (category.includes("学习") || category.includes("教育")) {
    return <BookOpen {...props} />;
  }
  if (category.includes("丽人") || category.includes("美妆")) {
    return <Sparkles {...props} />;
  }
  if (category.includes("工资")) return <Banknote {...props} />;
  if (category.includes("理财") || category.includes("投资")) {
    return <TrendingUp {...props} />;
  }
  if (category.includes("兼职")) return <Briefcase {...props} />;
  if (category.includes("奖金")) return <Gift {...props} />;
  if (category.includes("其它收入")) return <Coins {...props} />;
  if (category.includes("其它") || category.includes("其他")) {
    return <Package {...props} />;
  }
  return <Shapes {...props} />;
}
