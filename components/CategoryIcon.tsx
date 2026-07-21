import {
  Briefcase,
  Car,
  CircleDollarSign,
  Clapperboard,
  HeartPulse,
  House,
  Laptop,
  Shapes,
  ShoppingBag,
  Utensils,
  WalletCards,
} from "lucide-react";

export function CategoryIcon({
  category,
  className = "size-5",
}: {
  category: string;
  className?: string;
}) {
  const props = { className, "aria-hidden": true as const };

  if (category.includes("餐")) return <Utensils {...props} />;
  if (category.includes("交通")) return <Car {...props} />;
  if (category.includes("购物")) return <ShoppingBag {...props} />;
  if (category.includes("居住") || category.includes("住房") || category.includes("房")) {
    return <House {...props} />;
  }
  if (category.includes("数码")) return <Laptop {...props} />;
  if (category.includes("医疗") || category.includes("健康")) {
    return <HeartPulse {...props} />;
  }
  if (category.includes("娱乐")) return <Clapperboard {...props} />;
  if (category.includes("工资")) return <WalletCards {...props} />;
  if (category.includes("理财") || category.includes("投资")) {
    return <CircleDollarSign {...props} />;
  }
  if (category.includes("兼职")) return <Briefcase {...props} />;
  return <Shapes {...props} />;
}
