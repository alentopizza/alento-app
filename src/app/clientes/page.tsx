"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Ban,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  MapPin,
  MapPinned,
  RefreshCcw,
  Search,
  ShoppingCart,
  Star,
  Tag,
  Upload,
  UserPlus,
  AlertTriangle,
  UserRound,
  Users,
} from "lucide-react";
import ActionConfirmModal from "@/components/ActionConfirmModal";
import { orderCode } from "@/lib/orderCode";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { fulfillmentLabel, statusLabel, type FulfillmentType, type OrderStatus } from "@/lib/orderWorkflow";
import { emitLiveDataChange, subscribeLiveDataChange } from "@/lib/liveDataEvents";
import CustomerAddressEditor, {
  mergeCustomerAddressEditorValue,
} from "@/components/CustomerAddressEditor";
import CustomerPersonalEditor from "@/components/CustomerPersonalEditor";

type CustomerAddress = {
  id: number;
  label?: string | null;
  address: string;
  formattedAddress?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  neighborhood: string | null;
  city: string | null;
  notes: string | null;
  isDefault: boolean;
};

type CustomerMetrics = {
  purchaseCount: number;
  totalSpent: number;
  averageTicket: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  frequencyDays: number | null;
  canceledCount?: number;
  cancellationRate?: number;
};

type Customer = {
  id: number;
  name: string;
  countryCode: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt?: string;
  addresses: CustomerAddress[];
  _count: { orders: number };
  metrics: CustomerMetrics;
};

type CustomerOrder = {
  id: number;
  sequenceNumber: number | null;
  source: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  total: number | string;
  createdAt: string;
  items: {
    id: number;
    productName: string;
    quantity: number;
    unitPrice: number | string;
    lineTotal: number | string;
    configuration: unknown;
    notes: string | null;
  }[];
};

type CustomerDetail = Customer & {
  orders: CustomerOrder[];
};

type CustomerStatusFilter = "ALL" | "Nuevo" | "Activo" | "Frecuente" | "Por recuperar" | "Sin compras";
type CustomerAddressFilter = "ALL" | "VERIFIED" | "PENDING" | "NONE";

type ImportPreviewRow = {
  rowNumber: number;
  name: string;
  countryCode: string;
  phone: string;
  email: string;
  address: string;
};

type ImportIssue = {
  rowNumber: number;
  name: string;
  phone: string;
  reason: string;
};

type ImportPreview = {
  summary: {
    totalRows: number;
    toCreate: number;
    skipped: number;
  };
  preview: ImportPreviewRow[];
  issues: ImportIssue[];
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const shortDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Sin compras";

const dateTime = (value: string) =>
  new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function cleanDetailValue(value: string) {
  return value.replace(/^½\s*/u, "").trim();
}

function orderItemDetails(item: CustomerOrder["items"][number]) {
  return presentOrderItemConfiguration(item.configuration);
}

function purchaseLabel(count: number) {
  return `${count} ${count === 1 ? "compra" : "compras"}`;
}

function daysSince(value: string | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

function customerSignal(metrics: CustomerMetrics) {
  if (metrics.purchaseCount === 0) {
    return { label: "Sin compras", tone: "bg-violet-50 text-violet-700 border-violet-200" };
  }

  const inactiveDays = daysSince(metrics.lastOrderAt);
  if (metrics.purchaseCount === 1) {
    return { label: "Nuevo", tone: "bg-sky-50 text-sky-700 border-sky-200" };
  }

  const expected = metrics.frequencyDays ?? 30;
  const rescueThreshold = Math.max(21, Math.round(expected * 1.6));
  if (inactiveDays !== null && inactiveDays > rescueThreshold) {
    return { label: "Por recuperar", tone: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  if (metrics.purchaseCount >= 4) {
    return { label: "Frecuente", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  return { label: "Activo", tone: "bg-amber-50 text-amber-700 border-amber-200" };
}

function customerFilterTone(status: CustomerStatusFilter, active: boolean) {
  if (status === "Nuevo") {
    return active
      ? { button: "border-sky-300 bg-sky-50 text-sky-700 shadow-[0_5px_14px_rgba(14,165,233,.12)]", count: "bg-sky-600 text-white" }
      : { button: "border-sky-100 bg-white text-sky-700 hover:bg-sky-50", count: "border border-sky-100 bg-sky-50 text-sky-700" };
  }

  if (status === "Activo") {
    return active
      ? { button: "border-amber-300 bg-amber-50 text-amber-700 shadow-[0_5px_14px_rgba(245,158,11,.12)]", count: "bg-amber-500 text-white" }
      : { button: "border-amber-100 bg-white text-amber-700 hover:bg-amber-50", count: "border border-amber-100 bg-amber-50 text-amber-700" };
  }

  if (status === "Frecuente") {
    return active
      ? { button: "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_5px_14px_rgba(16,185,129,.12)]", count: "bg-emerald-600 text-white" }
      : { button: "border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50", count: "border border-emerald-100 bg-emerald-50 text-emerald-700" };
  }

  if (status === "Por recuperar") {
    return active
      ? { button: "border-rose-300 bg-rose-50 text-rose-700 shadow-[0_5px_14px_rgba(244,63,94,.12)]", count: "bg-rose-600 text-white" }
      : { button: "border-rose-100 bg-white text-rose-700 hover:bg-rose-50", count: "border border-rose-100 bg-rose-50 text-rose-700" };
  }

  if (status === "Sin compras") {
    return active
      ? { button: "border-violet-300 bg-violet-50 text-violet-700 shadow-[0_5px_14px_rgba(139,92,246,.12)]", count: "bg-violet-600 text-white" }
      : { button: "border-violet-100 bg-white text-violet-700 hover:bg-violet-50", count: "border border-violet-100 bg-violet-50 text-violet-700" };
  }

  return active
    ? { button: "border-neutral-300 bg-neutral-950 text-white shadow-[0_5px_14px_rgba(23,23,23,.11)]", count: "bg-white text-neutral-950" }
    : { button: "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50", count: "border border-neutral-200 bg-neutral-100 text-neutral-700" };
}

function customerCardVisual(status: CustomerStatusFilter) {
  if (status === "Nuevo") {
    return {
      top: "bg-sky-500",
      avatar: "border-sky-100 bg-sky-50 text-sky-700",
    };
  }
  if (status === "Activo") {
    return {
      top: "bg-amber-500",
      avatar: "border-amber-100 bg-amber-50 text-amber-700",
    };
  }
  if (status === "Frecuente") {
    return {
      top: "bg-emerald-500",
      avatar: "border-emerald-100 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "Por recuperar") {
    return {
      top: "bg-rose-500",
      avatar: "border-rose-100 bg-rose-50 text-rose-700",
    };
  }
  if (status === "Sin compras") {
    return {
      top: "bg-violet-500",
      avatar: "border-violet-100 bg-violet-50 text-violet-700",
    };
  }
  return {
    top: "bg-neutral-950",
    avatar: "border-neutral-200 bg-neutral-100 text-neutral-800",
  };
}

function customerAddressState(customer: Customer) {
  const address = customer.addresses?.[0] ?? null;
  const hasAddress = Boolean(
    address?.address?.trim() || address?.formattedAddress?.trim(),
  );
  const verified = Boolean(
    address?.formattedAddress?.trim() &&
      address?.placeId?.trim() &&
      address?.latitude != null &&
      address?.longitude != null,
  );

  if (verified) {
    return {
      value: "VERIFIED" as const,
      label: "Google verificada",
      shortLabel: "Verificada",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (hasAddress) {
    return {
      value: "PENDING" as const,
      label: "Por actualizar en Google",
      shortLabel: "Por actualizar",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    value: "NONE" as const,
    label: "Sin dirección",
    shortLabel: "Sin dirección",
    tone: "border-neutral-200 bg-neutral-100 text-neutral-500",
  };
}

function CustomerAddressStateIcon({
  state,
  className = "h-3.5 w-3.5",
}: {
  state: ReturnType<typeof customerAddressState>["value"];
  className?: string;
}) {
  if (state === "VERIFIED") {
    return <CheckCircle2 className={className} strokeWidth={2.2} />;
  }
  if (state === "PENDING") {
    return <AlertTriangle className={className} strokeWidth={2.2} />;
  }
  return <MapPin className={className} strokeWidth={2.1} />;
}

function CustomerFilterIcon({
  status,
  className = "h-[17px] w-[17px]",
}: {
  status: CustomerStatusFilter;
  className?: string;
}) {
  if (status === "Nuevo") return <UserPlus className={className} strokeWidth={2.1} />;
  if (status === "Activo") return <Clock3 className={className} strokeWidth={2.1} />;
  if (status === "Frecuente") return <Star className={className} strokeWidth={2.1} />;
  if (status === "Por recuperar") return <RefreshCcw className={className} strokeWidth={2.1} />;
  if (status === "Sin compras") return <Ban className={className} strokeWidth={2.1} />;
  return <Users className={className} strokeWidth={2.1} />;
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: "purchases" | "ticket" | "spent";
}) {
  return (
    <div className="min-w-0 px-2.5 py-2 [font-synthesis:none]">
      <div className="flex items-center gap-1.5 text-neutral-400">
        {icon === "purchases" ? (
          <ShoppingCart className="h-3 w-3" strokeWidth={1.9} />
        ) : icon === "ticket" ? (
          <Tag className="h-3 w-3" strokeWidth={1.9} />
        ) : icon === "spent" ? (
          <BarChart3 className="h-3 w-3" strokeWidth={1.9} />
        ) : null}
        <span className="alento-ui-micro block truncate uppercase text-neutral-400">
          {label}
        </span>
      </div>
      <b className="alento-ui-control mt-1 block truncate font-black leading-none text-neutral-950">
        {value}
      </b>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>("ALL");
  const [addressFilter, setAddressFilter] = useState<CustomerAddressFilter>("ALL");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [editSection, setEditSection] = useState<"PERSONAL" | "LOCATION">("PERSONAL");
  const [selected, setSelected] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+57");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [addressEditor, setAddressEditor] = useState<{
    id: number | null;
    label: string;
    address: string;
    neighborhood: string;
    city: string;
    notes: string;
    isDefault: boolean;
    formattedAddress: string;
    placeId: string;
    latitude: number | null;
    longitude: number | null;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importStage, setImportStage] = useState<"preview" | "import" | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteEnabled, setBulkDeleteEnabled] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Customer | CustomerDetail | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function loadCustomers(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/customers?all=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los clientes.");
      setCustomers(data.customers ?? []);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadCustomers();

    async function loadCustomerSettings() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) return;
        setBulkDeleteEnabled(data.settings?.customerManagement?.bulkDeleteEnabled !== false);
      } catch {
        setBulkDeleteEnabled(true);
      }
    }

    void loadCustomerSettings();
  }, []);

  useEffect(() => {
    let running = false;

    async function refreshCustomerSurface() {
      if (running || document.visibilityState !== "visible") return;
      running = true;

      try {
        await loadCustomers(true);

        if (selected?.id) {
          const response = await fetch(`/api/customers/${selected.id}`, {
            cache: "no-store",
          });
          const data = await response.json();
          if (response.ok) {
            setSelected(data.customer);
          } else if (response.status === 404) {
            setSelected(null);
          }
        }
      } finally {
        running = false;
      }
    }

    const unsubscribe = subscribeLiveDataChange(
      ["customers", "orders", "club"],
      () => void refreshCustomerSurface(),
    );
    const timer = window.setInterval(() => void refreshCustomerSurface(), 8000);
    const onFocus = () => void refreshCustomerSurface();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCustomerSurface();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [selected?.id]);

  const statusCounts = useMemo(() => {
    const counts: Record<Exclude<CustomerStatusFilter, "ALL">, number> = {
      Nuevo: 0,
      Activo: 0,
      Frecuente: 0,
      "Por recuperar": 0,
      "Sin compras": 0,
    };

    customers.forEach((customer) => {
      const label = customerSignal(customer.metrics).label as Exclude<CustomerStatusFilter, "ALL">;
      counts[label] += 1;
    });

    return counts;
  }, [customers]);

  const addressCounts = useMemo(() => {
    const counts = {
      VERIFIED: 0,
      PENDING: 0,
      NONE: 0,
    };

    customers.forEach((customer) => {
      counts[customerAddressState(customer).value] += 1;
    });

    return counts;
  }, [customers]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    return customers.filter((customer) => {
      const signal = customerSignal(customer.metrics).label;
      const addressState = customerAddressState(customer).value;
      if (statusFilter !== "ALL" && signal !== statusFilter) return false;
      if (addressFilter !== "ALL" && addressState !== addressFilter) return false;
      if (!value) return true;

      return [
        customer.name,
        customer.phone,
        customer.email,
        customer.addresses?.[0]?.address,
        customer.notes,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    });
  }, [addressFilter, customers, query, statusFilter]);

  async function openCustomer(customer: Customer) {
    setDetailLoading(true);
    setDetailError("");
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar el cliente.");
      setSelected(data.customer);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No fue posible cargar el cliente.");
    } finally {
      setDetailLoading(false);
    }
  }

  function printCustomerOrder(orderId: number) {
    const frame = document.createElement("iframe");
    Object.assign(frame.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    });
    frame.src = `/pedidos/${orderId}/imprimir?autoprint=1&embedded=1`;
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 30000);
  }

  function openEdit(
    customer: Customer | CustomerDetail,
    section: "PERSONAL" | "LOCATION" = "PERSONAL",
  ) {
    setEditing(customer);
    setEditSection(section);
    setName(customer.name);
    setCountryCode(customer.countryCode || "+57");
    setPhone(customer.phone || "");
    setEmail(customer.email || "");
    setNotes(customer.notes || "");
    setMessage("");

    const savedAddress = customer.addresses?.[0] ?? null;
    setAddressEditor(
      savedAddress
        ? {
            id: savedAddress.id,
            label: savedAddress.label ?? "Casa",
            address: savedAddress.address,
            neighborhood: savedAddress.neighborhood ?? "",
            city: savedAddress.city ?? "Bogotá",
            notes: savedAddress.notes ?? "",
            isDefault: true,
            formattedAddress:
              savedAddress.formattedAddress ?? savedAddress.address,
            placeId: savedAddress.placeId ?? "",
            latitude: savedAddress.latitude ?? null,
            longitude: savedAddress.longitude ?? null,
          }
        : {
            id: null,
            label: "Casa",
            address: "",
            neighborhood: "",
            city: "Bogotá",
            notes: "",
            isDefault: true,
            formattedAddress: "",
            placeId: "",
            latitude: null,
            longitude: null,
          },
    );
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setEditSection("PERSONAL");
    setMessage("");
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    if (!name.trim() || !phone.trim()) {
      setEditSection("PERSONAL");
      setMessage("Nombre y teléfono son obligatorios.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/customers/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, countryCode, phone, email, notes }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible actualizar el cliente.");
      }

      const hasValidatedAddress =
        Boolean(addressEditor?.formattedAddress.trim()) &&
        Boolean(addressEditor?.placeId.trim()) &&
        addressEditor?.latitude != null &&
        addressEditor?.longitude != null;

      if (hasValidatedAddress && addressEditor) {
        const addressResponse = await fetch(
          `/api/customers/${editing.id}/addresses`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...addressEditor,
              address: addressEditor.formattedAddress,
              isDefault: true,
            }),
          },
        );
        const addressData = await addressResponse.json();

        if (!addressResponse.ok) {
          setEditSection("LOCATION");
          throw new Error(
            addressData.error || "No fue posible guardar la dirección.",
          );
        }
      }

      emitLiveDataChange(["customers", "account"]);
      await loadCustomers(true);

      if (selected?.id === editing.id) {
        await openCustomer({
          ...editing,
          ...data.customer,
          metrics: editing.metrics,
        });
      }

      setEditing(null);
      setEditSection("PERSONAL");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el cliente.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function exportCustomers() {
    setDetailError("");
    try {
      const response = await fetch("/api/customers/export", { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible exportar los clientes.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "clientes-alento.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No fue posible exportar los clientes.");
    }
  }

  async function downloadCustomerTemplate() {
    try {
      const response = await fetch("/api/customers/import/template", { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible descargar la plantilla.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "template-clientes-alento.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "No fue posible descargar la plantilla.");
    }
  }

  function deleteCustomer(customer: Customer | CustomerDetail) {
    setDeleteTarget(customer);
  }

  async function confirmDeleteCustomer() {
    if (!deleteTarget) return;

    setDeleteBusy(true);
    setDetailError("");

    try {
      const response = await fetch(`/api/customers/${deleteTarget.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible eliminar el cliente.");

      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      await loadCustomers();
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No fue posible eliminar el cliente.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function closeImport() {
    if (importBusy) return;
    setImportOpen(false);
    setImportFile(null);
    setImportPreview(null);
    setImportStage(null);
    setImportMessage("");
  }

  async function previewImport(file: File) {
    setImportBusy(true);
    setImportStage("preview");
    setImportMessage("");
    setImportPreview(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("action", "preview");
      const response = await fetch("/api/customers/import", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible analizar el archivo.");
      setImportPreview(data);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "No fue posible analizar el archivo.");
    } finally {
      setImportBusy(false);
      setImportStage(null);
    }
  }

  function toggleCustomerSelection(customer: Customer) {
    if (customer._count.orders > 0) return;
    setSelectedCustomerIds((current) =>
      current.includes(customer.id)
        ? current.filter((id) => id !== customer.id)
        : [...current, customer.id],
    );
  }

  function toggleBulkMode() {
    setBulkMode((current) => {
      const next = !current;
      if (!next) setSelectedCustomerIds([]);
      return next;
    });
  }

  function selectAllEligibleVisible() {
    const eligibleIds = filtered.filter((customer) => customer._count.orders === 0).map((customer) => customer.id);
    setSelectedCustomerIds(eligibleIds);
  }

  async function deleteSelectedCustomers() {
    if (selectedCustomerIds.length === 0) return;
    setBulkDeleting(true);
    setDetailError("");
    try {
      const response = await fetch("/api/customers/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedCustomerIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible eliminar los clientes seleccionados.");

      await loadCustomers();
      setSelectedCustomerIds([]);
      setBulkMode(false);
      setBulkConfirmOpen(false);

      const message = data.skipped > 0
        ? `${data.deleted} clientes eliminados · ${data.skipped} omitidos`
        : `${data.deleted} clientes eliminados`;
      setImportSuccess(message);
      window.setTimeout(() => setImportSuccess(""), 5000);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "No fue posible eliminar los clientes seleccionados.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function confirmImport() {
    if (!importFile || !importPreview || importPreview.summary.toCreate === 0) return;
    setImportBusy(true);
    setImportStage("import");
    setImportMessage("");
    try {
      const formData = new FormData();
      formData.set("file", importFile);
      formData.set("action", "import");
      const response = await fetch("/api/customers/import", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible importar los clientes.");

      await loadCustomers();

      const successText = data.skipped > 0
        ? `Importación finalizada · ${data.imported} clientes agregados · ${data.skipped} omitidos`
        : `Importación finalizada · ${data.imported} clientes agregados`;

      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setImportMessage("");
      setImportSuccess(successText);
      window.setTimeout(() => setImportSuccess(""), 5000);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "No fue posible importar los clientes.");
    } finally {
      setImportBusy(false);
      setImportStage(null);
    }
  }

  return (
    <main className="min-h-screen w-full bg-[#f4f4f2] p-3 md:p-5 xl:p-6">
      <div className="w-full space-y-5">
        <section className="relative min-h-[116px] w-full overflow-hidden rounded-[24px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_14px_36px_rgba(20,16,14,.11)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <Users className="absolute right-[30%] top-[-18px] h-36 w-36 rotate-[-10deg] text-white/[0.03]" strokeWidth={1.15} />
          <div className="absolute inset-y-0 right-0 w-[46%] opacity-65 [background:repeating-linear-gradient(120deg,transparent_0_54px,rgba(255,255,255,.022)_55px_56px)]" />
          <div className="absolute right-[9%] top-[22px] h-[2px] w-[30%] bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="relative flex min-h-[116px] flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center md:px-6 xl:px-7">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="h-[2px] w-7 rounded-full bg-[var(--brand-red)]" />
                <p className="alento-ui-label uppercase tracking-[0.2em] text-white/55">
                  Relación con clientes
                </p>
              </div>
              <h1 className="alento-ui-hero-title mt-1.5">
                Clientes
              </h1>
              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Conoce quién compra, cuánto vuelve y dónde existe una oportunidad de recuperar ventas.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 self-end md:self-auto">
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                aria-label="Importar clientes"
                title="Importar clientes"
                className="group inline-flex h-[56px] w-[76px] shrink-0 items-center justify-center rounded-[16px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] text-white shadow-[0_10px_22px_rgba(168,11,16,.25),inset_0_1px_0_rgba(255,255,255,.13)] transition hover:-translate-y-0.5 hover:border-red-300/70 hover:brightness-110 active:translate-y-0"
              >
                <Upload className="h-[22px] w-[22px]" strokeWidth={2.2} />
              </button>

              <button
                type="button"
                onClick={() => void exportCustomers()}
                aria-label="Exportar clientes"
                title="Exportar clientes"
                className="group inline-flex h-[56px] w-[76px] shrink-0 items-center justify-center rounded-[16px] border border-red-400/45 bg-[linear-gradient(135deg,rgba(236,25,31,.96),rgba(119,12,16,.82))] text-white shadow-[0_10px_22px_rgba(168,11,16,.25),inset_0_1px_0_rgba(255,255,255,.13)] transition hover:-translate-y-0.5 hover:border-red-300/70 hover:brightness-110 active:translate-y-0"
              >
                <Download className="h-[22px] w-[22px]" strokeWidth={2.2} />
              </button>

              <div className="flex h-[56px] w-[76px] shrink-0 flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-sm">
                <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                  Clientes
                </span>
                <b className="alento-ui-metric mt-0.5 tabular-nums text-white">
                  {customers.length}
                </b>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-neutral-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(28,23,20,.04)]">
          <div className="grid gap-2 xl:grid-cols-[minmax(300px,1fr)_auto]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={2} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="alento-ui-control h-10 w-full rounded-xl border border-neutral-200 bg-[#faf9f7] pl-10 pr-3 outline-none transition focus:border-neutral-400 focus:bg-white"
                placeholder="Buscar cliente, teléfono o dirección"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {([
                ["ALL", "Todas", customers.length],
                ["VERIFIED", "Verificadas", addressCounts.VERIFIED],
                ["PENDING", "Por actualizar", addressCounts.PENDING],
                ["NONE", "Sin dirección", addressCounts.NONE],
              ] as [CustomerAddressFilter, string, number][]).map(
                ([value, label, count]) => {
                  const active = addressFilter === value;
                  const tone =
                    value === "VERIFIED"
                      ? active
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-emerald-100 bg-white text-emerald-700"
                      : value === "PENDING"
                        ? active
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-amber-100 bg-white text-amber-700"
                        : value === "NONE"
                          ? active
                            ? "border-neutral-400 bg-neutral-100 text-neutral-700"
                            : "border-neutral-200 bg-white text-neutral-500"
                          : active
                            ? "border-neutral-950 bg-neutral-950 text-white"
                            : "border-neutral-200 bg-white text-neutral-600";

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAddressFilter(value)}
                      className={`alento-ui-micro inline-flex h-10 items-center gap-1.5 rounded-xl border px-2.5 font-bold transition ${tone}`}
                    >
                      {value === "VERIFIED" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                      ) : value === "PENDING" ? (
                        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.2} />
                      ) : value === "NONE" ? (
                        <MapPin className="h-3.5 w-3.5" strokeWidth={2.1} />
                      ) : (
                        <MapPinned className="h-3.5 w-3.5" strokeWidth={2.1} />
                      )}
                      <span>{label}</span>
                      <span className={`rounded-full px-1.5 py-0.5 tabular-nums ${
                        active ? "bg-black/10" : "bg-neutral-100"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {([
              ["ALL", "Todos", customers.length],
              ["Nuevo", "Nuevo", statusCounts.Nuevo],
              ["Activo", "Activo", statusCounts.Activo],
              ["Frecuente", "Frecuente", statusCounts.Frecuente],
              ["Por recuperar", "Por recuperar", statusCounts["Por recuperar"]],
              ["Sin compras", "Sin compras", statusCounts["Sin compras"]],
            ] as [CustomerStatusFilter, string, number][]).map(([value, label, count]) => {
              const active = statusFilter === value;
              const tone = customerFilterTone(value, active);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`flex h-9 min-w-0 items-center justify-between gap-1.5 rounded-[10px] border px-2.5 alento-ui-micro font-bold transition ${tone.button}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <CustomerFilterIcon status={value} className="h-3.5 w-3.5" />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 font-black tabular-nums ${tone.count}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {bulkDeleteEnabled && (
          <section className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleBulkMode}
                className={`rounded-xl border px-3.5 py-2.5 text-[11px] font-bold transition ${bulkMode ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}
              >
                {bulkMode ? "Salir de selección" : "Selección múltiple"}
              </button>
              {bulkMode && (
                <>
                  <button
                    type="button"
                    onClick={selectAllEligibleVisible}
                    className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    Seleccionar elegibles
                  </button>
                  <span className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] font-bold tabular-nums text-neutral-700 shadow-sm">
                    {selectedCustomerIds.length} seleccionados
                  </span>
                </>
              )}
            </div>

            {bulkMode && (
              <button
                type="button"
                disabled={selectedCustomerIds.length === 0}
                onClick={() => setBulkConfirmOpen(true)}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[11px] font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Eliminar seleccionados
              </button>
            )}
          </section>
        )}

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-400">No hay clientes para mostrar.</div>
        ) : (
          <section className="grid items-start gap-2.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((customer) => {
              const signal = customerSignal(customer.metrics);
              const visual = customerCardVisual(
                signal.label as CustomerStatusFilter,
              );
              const addressState = customerAddressState(customer);
              const address = customer.addresses?.[0] ?? null;

              return (
                <article
                  key={customer.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    bulkMode
                      ? toggleCustomerSelection(customer)
                      : void openCustomer(customer)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      if (bulkMode) toggleCustomerSelection(customer);
                      else void openCustomer(customer);
                    }
                  }}
                  className={`group relative cursor-pointer overflow-hidden rounded-[17px] border bg-white shadow-[0_7px_20px_rgba(28,23,20,.045)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(28,23,20,.08)] ${
                    selectedCustomerIds.includes(customer.id)
                      ? "border-red-300 ring-2 ring-red-100"
                      : "border-neutral-200 hover:border-neutral-300"
                  } ${bulkMode && customer._count.orders > 0 ? "opacity-55" : ""}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-[3px] ${visual.top}`} />

                  <div className="p-3.5 pt-4">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border alento-ui-status font-black shadow-sm ${visual.avatar}`}
                      >
                        {customer.name.trim().charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="alento-ui-status truncate text-neutral-950">
                              {customer.name}
                            </h2>
                            <p className="alento-ui-micro mt-0.5 truncate text-neutral-500">
                              {customer.countryCode} {customer.phone || "Sin teléfono"}
                            </p>
                          </div>

                          <span
                            className={`alento-ui-micro shrink-0 rounded-full border px-2 py-1 font-bold uppercase ${signal.tone}`}
                          >
                            {signal.label}
                          </span>
                        </div>

                        <div className="mt-2 flex min-w-0 items-center gap-1.5">
                          <MapPin
                            className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                            strokeWidth={2}
                          />
                          <span className="alento-ui-micro min-w-0 flex-1 truncate text-neutral-500">
                            {address?.formattedAddress ||
                              address?.address ||
                              "Sin dirección registrada"}
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span
                            className={`alento-ui-micro inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-1 font-bold ${addressState.tone}`}
                            title={addressState.label}
                          >
                            <CustomerAddressStateIcon
                              state={addressState.value}
                              className="h-3 w-3 shrink-0"
                            />
                            <span className="truncate">
                              {addressState.shortLabel}
                            </span>
                          </span>

                          {bulkMode && (
                            <span
                              className={`flex h-6 min-w-6 items-center justify-center rounded-lg border px-1.5 alento-ui-micro font-bold ${
                                customer._count.orders > 0
                                  ? "border-neutral-200 bg-neutral-100 text-neutral-400"
                                  : selectedCustomerIds.includes(customer.id)
                                    ? "border-red-600 bg-red-600 text-white"
                                    : "border-neutral-300 bg-white text-neutral-600"
                              }`}
                            >
                              {customer._count.orders > 0
                                ? "Bloq."
                                : selectedCustomerIds.includes(customer.id)
                                  ? "✓"
                                  : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 divide-x divide-neutral-200 rounded-[12px] border border-neutral-100 bg-[#f8f9fb]">
                      <Metric
                        label="Compras"
                        value={String(customer.metrics.purchaseCount)}
                        icon="purchases"
                      />
                      <Metric
                        label="Ticket"
                        value={money(customer.metrics.averageTicket)}
                        icon="ticket"
                      />
                      <Metric
                        label="Comprado"
                        value={money(customer.metrics.totalSpent)}
                        icon="spent"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {deleteTarget && (
          <ActionConfirmModal
            variant="danger"
            eyebrow="Eliminar cliente"
            title={`Eliminar a ${deleteTarget.name}`}
            description="Esta acción no se puede deshacer."
            detail={
              deleteTarget._count.orders > 0
                ? `Sus ${deleteTarget._count.orders} pedido(s) se conservarán en el sistema, pero quedarán sin cliente asociado.`
                : "El cliente será eliminado definitivamente de la base de clientes."
            }
            confirmLabel="Eliminar cliente"
            cancelLabel="Cancelar"
            busy={deleteBusy}
            onClose={() => !deleteBusy && setDeleteTarget(null)}
            onConfirm={() => void confirmDeleteCustomer()}
          />
        )}

        {bulkDeleteEnabled && bulkConfirmOpen && (
          <ActionConfirmModal
            variant="danger"
            eyebrow="Eliminación masiva"
            title="Eliminar clientes"
            description={`¿Deseas eliminar ${selectedCustomerIds.length} cliente(s) seleccionados?`}
            detail="Solo se eliminarán clientes sin pedidos asociados. Esta acción no se puede deshacer."
            confirmLabel="Eliminar seleccionados"
            cancelLabel="Volver"
            busy={bulkDeleting}
            onClose={() => !bulkDeleting && setBulkConfirmOpen(false)}
            onConfirm={() => void deleteSelectedCustomers()}
          />
        )}

        {importOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[3px]">
            <div className="max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-[26px] border border-white/10 bg-[#f7f4ef] shadow-[0_28px_90px_rgba(0,0,0,.32)]">
              <header className="bg-[radial-gradient(circle_at_86%_12%,rgba(229,28,17,.18),transparent_30%),linear-gradient(135deg,#09090a,#191617)] px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Base de clientes</p>
                    <h2 className="mt-1 text-[25px] font-bold tracking-[-0.025em]">Importar clientes</h2>
                    <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-white/65">Carga tu archivo CSV, revisa qué registros entrarán y corrige los que tengan problemas antes de confirmar.</p>
                  </div>
                  <button type="button" onClick={closeImport} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-lg text-white">×</button>
                </div>
              </header>

              <div className="alento-scroll max-h-[68vh] overflow-y-auto px-5 py-5 md:px-6">
                <label className="block rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center shadow-sm transition hover:border-neutral-400">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setImportFile(file);
                      setImportPreview(null);
                      setImportMessage("");
                      if (file) void previewImport(file);
                    }}
                  />
                  <span className="block text-[15px] font-bold text-neutral-900">{importFile ? importFile.name : "Seleccionar archivo CSV"}</span>
                  <span className="mt-1.5 block text-[12px] text-neutral-500">Nombre, indicativo y teléfono son suficientes. Máximo 5 MB.</span>
                </label>

                <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-sky-600">Plantilla recomendada</p>
                      <b className="mt-0.5 block text-[14px] text-sky-950">Evita errores usando el formato oficial</b>
                      <p className="mt-1 text-[12px] leading-5 text-sky-800">Incluye encabezados correctos y una fila de ejemplo.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void downloadCustomerTemplate()}
                      className="shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.04em] text-white shadow-sm transition hover:bg-sky-700"
                    >
                      Descargar plantilla
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-sky-100 bg-white p-3">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">Obligatorios</span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {["Nombre", "Indicativo", "Teléfono"].map((label) => (
                          <span key={label} className="rounded-lg bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-700">{label}</span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-sky-100 bg-white p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400">Opcionales</span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {["Correo", "Dirección", "Complemento", "GPS", "Notas"].map((label) => (
                          <span key={label} className="rounded-lg bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">{label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {importBusy && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--brand-red)]" />
                    <div>
                      <b className="block text-[11px] text-neutral-800">{importStage === "import" ? "Importando clientes..." : "Analizando archivo..."}</b>
                      <span className="text-[11px] text-neutral-500">{importStage === "import" ? "Guardando los clientes validados en Alentó." : "Validando formato, teléfonos y duplicados."}</span>
                    </div>
                  </div>
                )}

                {importMessage && (
                  <div className="mt-3 rounded-xl border border-neutral-200 bg-[#faf9f7] px-4 py-3 text-sm font-semibold text-neutral-700">{importMessage}</div>
                )}

                {importPreview && (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Metric label="Filas" value={String(importPreview.summary.totalRows)} />
                      <Metric label="Nuevos" value={String(importPreview.summary.toCreate)} />
                      <Metric label="Omitidos" value={String(importPreview.summary.skipped)} />
                    </div>

                    {importPreview.preview.length > 0 && (
                      <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
                        <div className="border-b border-neutral-100 bg-[#faf9f7] px-4 py-3">
                          <b className="text-xs text-neutral-800">Vista previa de clientes nuevos</b>
                        </div>
                        <div className="divide-y divide-neutral-100">
                          {importPreview.preview.map((row) => (
                            <div key={row.rowNumber} className="grid gap-1 px-4 py-3 sm:grid-cols-[1.2fr_.8fr_1.4fr] sm:items-center">
                              <div>
                                <b className="block text-[12px] text-neutral-900">{row.name}</b>
                                <span className="text-[10px] text-neutral-400">Fila {row.rowNumber}</span>
                              </div>
                              <span className="text-[11px] text-neutral-600">{row.countryCode} {row.phone}</span>
                              <span className="truncate text-[11px] text-neutral-500">{row.address || "Sin dirección"}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {importPreview.issues.length > 0 && (
                      <section className="mt-4 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/50">
                        <div className="flex items-center justify-between gap-3 border-b border-rose-100 px-4 py-3">
                          <div>
                            <b className="block text-xs text-rose-950">Contactos que no se importarán</b>
                            <span className="mt-0.5 block text-[11px] text-rose-700">Revisa el motivo indicado en cada registro.</span>
                          </div>
                          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-rose-700">{importPreview.issues.length}</span>
                        </div>
                        <div className="max-h-60 divide-y divide-rose-100 overflow-y-auto">
                          {importPreview.issues.map((issue, index) => (
                            <div key={`${issue.rowNumber}-${index}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <b className="truncate text-[11px] text-neutral-900">{issue.name || "Sin nombre"}</b>
                                  {issue.phone && <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-500">{issue.phone}</span>}
                                </div>
                                <p className="mt-1 text-[10px] font-medium leading-4 text-rose-700">{issue.reason}</p>
                              </div>
                              <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-neutral-400">Fila {issue.rowNumber}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-4 md:px-6">
                <p className="text-[11px] leading-4 text-neutral-500">Los clientes existentes se conservan sin cambios para proteger su historial.</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={closeImport} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">Cancelar</button>
                  <button
                    type="button"
                    onClick={() => void confirmImport()}
                    disabled={importBusy || !importPreview || importPreview.summary.toCreate === 0}
                    className="rounded-xl bg-[var(--brand-red)] px-4 py-2.5 text-xs font-bold text-white disabled:bg-neutral-300"
                  >
                    {importBusy ? "Importando..." : importPreview ? `Importar ${importPreview.summary.toCreate}` : "Importar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {importSuccess && (
          <div className="fixed right-5 top-5 z-[150] w-[min(92vw,390px)] rounded-2xl border border-emerald-200 bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,.16)] [font-synthesis:none]">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg font-black text-emerald-700">✓</span>
              <div className="min-w-0">
                <b className="block text-[13px] text-neutral-950">Importación finalizada</b>
                <p className="mt-1 text-[10px] leading-4 text-neutral-500">{importSuccess.replace("Importación finalizada · ", "")}</p>
              </div>
              <button type="button" onClick={() => setImportSuccess("")} className="ml-auto text-sm text-neutral-400">×</button>
            </div>
          </div>
        )}

        {detailLoading && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
            <div className="rounded-2xl bg-white px-5 py-4 text-sm font-semibold shadow-2xl">Cargando perfil...</div>
          </div>
        )}

        {detailError && (
          <div className="fixed bottom-5 right-5 z-[100] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg">
            {detailError}
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[3px]" onClick={() => setSelected(null)}>
            <aside
              onClick={(event) => event.stopPropagation()}
              className="absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col overflow-hidden bg-[#f5f2ee] shadow-[-24px_0_70px_rgba(0,0,0,.24)]"
            >
              <header className="alento-dark rounded-none px-5 py-5 md:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Perfil del cliente</p>
                    <h2 className="mt-1 truncate text-2xl font-black tracking-[-0.03em]">{selected.name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                      <span>{selected.countryCode} {selected.phone || "Sin teléfono"}</span>
                      {selected.email && <span>• {selected.email}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-lg text-white">×</button>
                </div>
              </header>

              <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
                <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {[
                    ["Compras", String(selected.metrics.purchaseCount), ""],
                    ["Ticket promedio", money(selected.metrics.averageTicket), ""],
                    ["Total comprado", money(selected.metrics.totalSpent), ""],
                    ["Frecuencia", selected.metrics.frequencyDays ? `Cada ${selected.metrics.frequencyDays} d` : "Sin patrón", ""],
                    [
                      "Cancelados",
                      String(selected.metrics.canceledCount ?? 0),
                      (selected.metrics.canceledCount ?? 0) > 0
                        ? `${selected.metrics.cancellationRate ?? 0}% del historial`
                        : "Sin cancelaciones",
                    ],
                  ].map(([label, value, hint]) => (
                    <div
                      key={label}
                      className={
                        "rounded-2xl border p-4 shadow-[0_10px_24px_rgba(28,23,20,.055)] [font-synthesis:none] " +
                        (label === "Cancelados" && (selected.metrics.canceledCount ?? 0) > 0
                          ? "border-red-200 bg-red-50/70"
                          : "border-neutral-200 bg-white")
                      }
                    >
                      <span
                        className={
                          "block text-[10px] font-bold uppercase tracking-[0.08em] " +
                          (label === "Cancelados" && (selected.metrics.canceledCount ?? 0) > 0
                            ? "text-red-500"
                            : "text-neutral-400")
                        }
                      >
                        {label}
                      </span>
                      <b
                        className={
                          "mt-2 block truncate text-[18px] font-bold leading-none tracking-[-0.018em] " +
                          (label === "Cancelados" && (selected.metrics.canceledCount ?? 0) > 0
                            ? "text-red-700"
                            : "text-neutral-950")
                        }
                      >
                        {value}
                      </b>
                      {hint && (
                        <span className="mt-1.5 block truncate text-[11px] text-neutral-400">
                          {hint}
                        </span>
                      )}
                    </div>
                  ))}
                </section>

                <section className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_12px_28px_rgba(28,23,20,.06)] [font-synthesis:none]">
                  <div className="flex items-start justify-between gap-4 border-b border-neutral-100 bg-[linear-gradient(135deg,#ffffff,#faf8f5)] px-4 py-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">Seguimiento comercial</p>
                      <h3 className="mt-1 text-[20px] font-bold tracking-[-0.025em] text-neutral-950">
                        {customerSignal(selected.metrics).label}
                      </h3>
                    </div>
                    <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.045em] ${customerSignal(selected.metrics).tone}`}>
                      {purchaseLabel(selected.metrics.purchaseCount)}
                    </span>
                  </div>

                  <div className="grid gap-2 p-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-neutral-100 bg-[#faf9f7] p-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">Primera compra</span>
                      <b className="mt-1.5 block text-[13px] text-neutral-800">{shortDate(selected.metrics.firstOrderAt)}</b>
                    </div>
                    <div className="rounded-xl border border-neutral-100 bg-[#faf9f7] p-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">Última compra</span>
                      <b className="mt-1.5 block text-[13px] text-neutral-800">{shortDate(selected.metrics.lastOrderAt)}</b>
                    </div>
                    <div className="rounded-xl border border-neutral-100 bg-[#faf9f7] p-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">Sin comprar</span>
                      <b className="mt-1.5 block text-[13px] text-neutral-800">
                        {daysSince(selected.metrics.lastOrderAt) === null ? "—" : `${daysSince(selected.metrics.lastOrderAt)} días`}
                      </b>
                    </div>
                  </div>
                </section>

                <section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_28px_rgba(28,23,20,.06)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-400">Datos del cliente</p>
                      <h3 className="mt-1 text-base font-bold">Contacto y entrega</h3>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(selected)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[10px] font-bold text-neutral-700 shadow-sm">
                        Editar
                      </button>
                      <button
                        onClick={() => void deleteCustomer(selected)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700 shadow-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#faf9f7] p-3 text-[11px] text-neutral-600">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Teléfono</span>
                      <b className="mt-1 block text-[12px] text-neutral-850">{selected.countryCode} {selected.phone || "Sin teléfono"}</b>
                    </div>
                    <div className="rounded-xl bg-[#faf9f7] p-3 text-[11px] text-neutral-600">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Correo</span>
                      <b className="mt-1 block truncate text-[12px] text-neutral-850">{selected.email || "Sin correo"}</b>
                    </div>
                  </div>

                  <div className="mt-2">
                    {selected.addresses[0] ? (
                      <div className="rounded-xl border border-neutral-100 bg-[#fcfbf9] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <b className="text-[11px] text-neutral-850">
                            {selected.addresses[0].formattedAddress ||
                              selected.addresses[0].address}
                          </b>
                          {selected.addresses[0].placeId &&
                          selected.addresses[0].latitude != null &&
                          selected.addresses[0].longitude != null ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                              Google
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                              Actualizar
                            </span>
                          )}
                        </div>
                        {(selected.addresses[0].neighborhood ||
                          selected.addresses[0].city) && (
                          <p className="mt-1 text-[10px] text-neutral-500">
                            {[
                              selected.addresses[0].neighborhood,
                              selected.addresses[0].city,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-3 text-[11px] text-neutral-400">
                        Sin dirección registrada.
                      </div>
                    )}
                  </div>

                  {selected.notes && (
                    <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-600">Nota</span>
                      <p className="mt-1 text-[11px] leading-4 text-amber-900">{selected.notes}</p>
                    </div>
                  )}
                </section>

                <section className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_14px_32px_rgba(28,23,20,.065)]">
                  <div className="flex items-center justify-between border-b border-neutral-100 bg-[linear-gradient(135deg,#ffffff,#faf8f5)] px-4 py-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">Historial de compra</p>
                      <h3 className="mt-0.5 text-[18px] font-bold tracking-[-0.02em] text-neutral-950">Pedidos del cliente</h3>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[10px] font-bold text-neutral-700 shadow-sm">
                        {selected.orders.length} pedidos
                      </span>
                      {(selected.metrics.canceledCount ?? 0) > 0 && (
                        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-bold text-red-700">
                          {selected.metrics.canceledCount} cancelados
                        </span>
                      )}
                    </div>
                  </div>

                  {selected.orders.length === 0 ? (
                    <p className="p-5 text-sm text-neutral-400">Este cliente todavía no tiene compras registradas.</p>
                  ) : (
                    <div className="space-y-3 bg-[#f7f5f2] p-3">
                      {selected.orders.map((order) => (
                        <article
                          key={order.id}
                          className={
                            "overflow-hidden rounded-2xl border shadow-[0_8px_20px_rgba(28,23,20,.045)] [font-synthesis:none] " +
                            (order.status === "CANCELED"
                              ? "border-red-200 bg-red-50/45"
                              : "border-neutral-200 bg-white")
                          }
                        >
                          <div
                            className={
                              "flex items-start justify-between gap-3 border-b px-4 py-3.5 " +
                              (order.status === "CANCELED"
                                ? "border-red-100 bg-red-50/70"
                                : "border-neutral-100")
                            }
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <b className="text-[14px] font-bold text-neutral-950">{orderCode(order.sequenceNumber ?? order.id, order.source)}</b>
                                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-bold uppercase text-neutral-600">{fulfillmentLabel(order.fulfillmentType)}</span>
                                <span
                                  className={
                                    "rounded-full border px-2 py-1 text-[11px] font-bold uppercase " +
                                    (order.status === "CANCELED"
                                      ? "border-red-200 bg-white text-red-600"
                                      : "border-neutral-200 bg-neutral-50 text-neutral-600")
                                  }
                                >
                                  {order.status === "CANCELED" ? "Cancelado" : statusLabel(order.status)}
                                </span>
                              </div>
                              <p className="mt-1.5 text-[11px] text-neutral-400">{dateTime(order.createdAt)}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <b
                                className={
                                  "text-[16px] font-bold tabular-nums tracking-[-0.015em] " +
                                  (order.status === "CANCELED"
                                    ? "text-neutral-400 line-through"
                                    : "text-neutral-950")
                                }
                              >
                                {money(order.total)}
                              </b>
                              <button
                                type="button"
                                onClick={() => printCustomerOrder(order.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950"
                                title="Imprimir copia del pedido"
                                aria-label="Imprimir copia del pedido"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                                  <path d="M6 9V3h12v6" />
                                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                  <path d="M6 14h12v7H6z" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {order.status === "CANCELED" && (
                            <div className="border-b border-red-100 bg-white/60 px-4 py-2 text-[11px] font-semibold text-red-600">
                              Pedido realizado y posteriormente cancelado. Se conserva en el historial comercial y no cuenta como compra válida.
                            </div>
                          )}

                          <div className="space-y-2.5 p-3">
                            {order.items.map((item) => {
                              const details = orderItemDetails(item);
                              const size = details.find((detail) => detail.label.toLowerCase() === "tamaño");
                              const crust = details.find((detail) => detail.label.toLowerCase() === "borde");
                              const flavors = details.filter((detail) => detail.label.toLowerCase().startsWith("sabor"));
                              const extras = details.filter((detail) => detail.label.toLowerCase() === "extra");
                              const others = details.filter((detail) => {
                                const label = detail.label.toLowerCase();
                                return label !== "tamaño" && label !== "borde" && label !== "extra" && !label.startsWith("sabor") && label !== "producto";
                              });

                              return (
                                <div key={item.id} className="rounded-xl border border-neutral-100 bg-[#fcfbf9] p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <b className="block text-[13px] font-bold text-neutral-900">{item.quantity}× {item.productName}</b>
                                      {(size || crust) && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {size && <span className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold uppercase text-sky-800">{size.value}</span>}
                                          {crust && <span className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase text-neutral-700">{crust.value}</span>}
                                        </div>
                                      )}
                                    </div>
                                    <b className="shrink-0 text-[12px] font-bold tabular-nums text-neutral-700">{money(item.lineTotal)}</b>
                                  </div>

                                  {flavors.length > 0 && (
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                      {flavors.map((detail, index) => (
                                        <span key={`${detail.label}-${index}`} className="contents">
                                          <span className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase text-neutral-900">{cleanDetailValue(detail.value)}</span>
                                          {index < flavors.length - 1 && <span className="text-[11px] font-bold text-neutral-300">−</span>}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {extras.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {extras.map((detail, index) => (
                                        <span key={`${detail.value}-${index}`} className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase text-red-700">+ {detail.value}</span>
                                      ))}
                                    </div>
                                  )}

                                  {others.length > 0 && (
                                    <div className="mt-2 grid gap-1">
                                      {others.map((detail, index) => (
                                        <p key={`${detail.label}-${index}`} className="text-[10px] text-neutral-500">
                                          <span className="font-semibold text-neutral-400">{detail.label}:</span> {detail.value}
                                        </p>
                                      ))}
                                    </div>
                                  )}

                                  {item.notes && (
                                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                                      <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-amber-800">{item.notes}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </aside>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-2 backdrop-blur-[4px] sm:p-4">
            <div className="alento-card flex max-h-[94dvh] w-[min(98vw,1180px)] max-w-none flex-col overflow-hidden rounded-[30px] bg-white shadow-[0_30px_90px_rgba(0,0,0,.30)]">
              <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-7">
                <div className="min-w-0">
                  <p className="alento-ui-label uppercase text-neutral-400">
                    Cliente #{editing.id}
                  </p>
                  <h2 className="alento-ui-title mt-1 truncate">Editar cliente</h2>
                  <p className="mt-1 truncate text-[11px] font-medium text-neutral-400">
                    {editing.name} · {editing.countryCode} {editing.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="shrink-0 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Cerrar
                </button>
              </div>

              <form onSubmit={saveCustomer} className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col bg-[#f7f6f3] lg:flex-row">
                  <aside className="shrink-0 border-b border-neutral-200 bg-white p-3 lg:w-[245px] lg:border-b-0 lg:border-r lg:p-4">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditSection("PERSONAL");
                          setMessage("");
                        }}
                        className={`flex min-h-[58px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                          editSection === "PERSONAL"
                            ? "border-neutral-950 bg-neutral-950 text-white shadow-[0_8px_20px_rgba(0,0,0,.12)]"
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            editSection === "PERSONAL"
                              ? "bg-white/12 text-white"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          <UserRound className="h-[18px] w-[18px]" strokeWidth={2} />
                        </span>
                        <span className="min-w-0">
                          <b className="block text-[12px]">Información personal</b>
                          <span
                            className={`mt-0.5 hidden text-[10px] leading-4 lg:block ${
                              editSection === "PERSONAL"
                                ? "text-white/55"
                                : "text-neutral-400"
                            }`}
                          >
                            Nombre y contacto
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditSection("LOCATION");
                          setMessage("");
                        }}
                        className={`flex min-h-[58px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                          editSection === "LOCATION"
                            ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white shadow-[0_8px_20px_rgba(226,26,34,.18)]"
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            editSection === "LOCATION"
                              ? "bg-white/14 text-white"
                              : "bg-red-50 text-[var(--brand-red)]"
                          }`}
                        >
                          <MapPin className="h-[18px] w-[18px]" strokeWidth={2.1} />
                        </span>
                        <span className="min-w-0">
                          <b className="block text-[12px]">Ubicación</b>
                          <span
                            className={`mt-0.5 hidden text-[10px] leading-4 lg:block ${
                              editSection === "LOCATION"
                                ? "text-white/65"
                                : "text-neutral-400"
                            }`}
                          >
                            Dirección y mapa
                          </span>
                        </span>
                      </button>
                    </div>

                    <div className="mt-4 hidden rounded-2xl border border-neutral-200 bg-[#faf9f7] p-3 lg:block">
                      <span className="alento-ui-label uppercase tracking-[0.12em] text-neutral-400">
                        Estado de ubicación
                      </span>
                      {addressEditor?.placeId &&
                      addressEditor.latitude != null &&
                      addressEditor.longitude != null ? (
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Validada con Google
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-amber-700">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Pendiente de validar
                        </div>
                      )}
                    </div>
                  </aside>

                  <div className="alento-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
                    {editSection === "PERSONAL" && (
                      <div className="mx-auto max-w-[830px]">
                        <CustomerPersonalEditor
                          name={name}
                          countryCode={countryCode}
                          phone={phone}
                          email={email}
                          notes={notes}
                          onNameChange={setName}
                          onCountryCodeChange={setCountryCode}
                          onPhoneChange={setPhone}
                          onEmailChange={setEmail}
                          onNotesChange={setNotes}
                        />
                      </div>
                    )}

                    {editSection === "LOCATION" && addressEditor && (
                      <div className="mx-auto max-w-[880px]">
                        <CustomerAddressEditor
                          value={addressEditor}
                          showDetailsBeforeValidation
                          onChange={(next) =>
                            setAddressEditor((current) =>
                              current
                                ? {
                                    ...mergeCustomerAddressEditorValue(
                                      current,
                                      next,
                                    ),
                                    isDefault: true,
                                  }
                                : current,
                            )
                          }
                        />
                      </div>
                    )}

                    {message && (
                      <p className="mx-auto mt-4 max-w-[880px] rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                        {message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-4 sm:px-7">
                  <span className="hidden text-[11px] font-medium text-neutral-400 sm:block">
                    {editSection === "PERSONAL"
                      ? "Información personal"
                      : "Ubicación y entrega"}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-2xl bg-[var(--brand-red)] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_18px_rgba(226,26,34,.16)] disabled:opacity-50"
                    >
                      {saving ? "Guardando..." : "Guardar cliente"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
