"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#245422",
            color: "#f1f7ef",
            borderRadius: "12px",
            fontSize: "14px",
          },
          success: { duration: 3000 },
          error: {
            duration: 5000,
            style: { background: "#dc2626", color: "#fff" },
          },
        }}
      />
    </QueryClientProvider>
  );
}
