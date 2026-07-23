/** 记账对话头像：River（与 App logo 分离） */
export function CatAvatar({
  size = 44,
  className = "",
  thinking = false,
}: {
  size?: number;
  className?: string;
  /** 思考中：轻微呼吸动画 */
  thinking?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden="true"
      className={[
        "shrink-0 rounded-full object-cover shadow-sm",
        thinking ? "animate-pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      draggable={false}
      height={size}
      src="/icons/river-avatar.png"
      style={{ width: size, height: size }}
      width={size}
    />
  );
}
