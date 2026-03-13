import { FigmaCaptureScript } from "./FigmaCaptureScript";

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FigmaCaptureScript />
      {children}
    </>
  );
}
