"use client";

import { Suspense } from "react";
import FourStepsWizard from "@/components/FourStepsWizard";

export default function Home() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando...</span></div>}>
      <FourStepsWizard />
    </Suspense>
  );
}
