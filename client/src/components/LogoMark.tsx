import logoSvg from "../assets/logo.svg";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export default function LogoMark({ size = 22, className }: LogoMarkProps) {
  return (
    <img
      src={logoSvg}
      alt="Claude Agent Template"
      width={size}
      height={size}
      className={className}
    />
  );
}
