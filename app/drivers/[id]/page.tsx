"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { User, Phone, Truck, CreditCard, ChevronRight, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const { data: driver, isLoading } = useQuery({
    queryKey: ["driver", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, profiles(full_name, phone), vehicles(identifier, details)")
        .eq("id", id)
        .single();
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("delete-driver", {
        body: { driver_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Driver deleted");
      qc.invalidateQueries({ queryKey: ["drivers"] });
      router.push("/drivers");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (!driver) {
    return (
      <AppShell>
        <PageHeader title="Driver" />
        <div className="px-4 md:px-6 py-8 text-tea-500">Driver not found.</div>
      </AppShell>
    );
  }

  const name = (driver.profiles as any)?.full_name ?? "Driver";
  const phone = (driver.profiles as any)?.phone;
  const vehicle = (driver.vehicles as any);

  return (
    <AppShell>
      <PageHeader title={name} subtitle="Driver" />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        {/* Info */}
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tea-100">
              <User className="h-6 w-6 text-tea-600" />
            </div>
            <div>
              <p className="font-semibold text-tea-900">{name}</p>
              {phone && (
                <p className="flex items-center gap-1 text-sm text-tea-500">
                  <Phone className="h-3.5 w-3.5" /> {phone}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-tea-100 pt-3 text-sm text-tea-500">
            <Truck className="h-4 w-4 text-tea-400" />
            {vehicle?.identifier ? (
              <span>
                Current vehicle: <span className="text-tea-800">{vehicle.identifier}</span>
              </span>
            ) : (
              <span>No vehicle linked yet</span>
            )}
          </div>
        </Card>

        {/* Cash link */}
        <Link href={`/cash/${id}`}>
          <Card padded={false} className="p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-tea-500" />
              <div className="flex-1">
                <p className="font-medium text-tea-900">Cash & reconciliation</p>
                <p className="text-sm text-tea-400">Float, paid out, daily history</p>
              </div>
              <ChevronRight className="h-4 w-4 text-tea-300" />
            </div>
          </Card>
        </Link>

        {/* Delete */}
        {!confirming ? (
          <Button variant="danger" fullWidth onClick={() => setConfirming(true)}>
            <Trash2 className="h-4 w-4" />
            Delete driver
          </Button>
        ) : (
          <Card className="border-red-200 bg-red-50 space-y-3">
            <p className="text-sm text-red-700">
              Delete <strong>{name}</strong>? Their login is removed and the phone
              number is freed. Past collections are kept but no longer linked to them.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                Delete
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
