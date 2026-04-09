"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /upload — Legacy route, redirects to the main retouche flow.
 * The old /api/upload endpoint no longer exists.
 */
export default function UploadRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/immobilier");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-zinc-400">Redirection...</p>
    </div>
  );
}
