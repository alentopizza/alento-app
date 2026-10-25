"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ActionConfirmModal from "@/components/ActionConfirmModal";
import { Image as ImageIcon, Pencil, Plus, Trash2, Upload } from "lucide-react";

type ProductType = "STANDARD" | "PIZZA_SINGLE" | "PIZZA_TWO_FLAVORS" | "COMBO" | "MODIFIER" | "INTERNAL";
type ProductImageSlot = "MAIN" | "SECONDARY";
type ComboOption = { id?: number; productId: number; productName?: string; quantity: number; priceDelta: number };
type ComboGroup = { id?: number; kind: string; name: string; minSelections: number; maxSelections: number; options: ComboOption[] };
type ComboPizzaRule = { id?: number; quantity: number; sizeIds: number[]; flavorIds: number[] };
type Product = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageUrl2: string | null;
  type: ProductType;
  basePrice: number | null;
  active: boolean;
  visibleInPos: boolean;
  featured: boolean;
  sortOrder: number;
  comboDiscount?: number | null;
  comboRegularMin?: number | null;
  comboRegularMax?: number | null;
  comboFinalMin?: number | null;
  comboFinalMax?: number | null;
  comboPizzaRules: ComboPizzaRule[];
  comboGroups: ComboGroup[];
};
type Category = { id: number; name: string; slug: string; active: boolean; visibleInPos: boolean; sortOrder: number; products: Product[] };
type PizzaSize = { id: number; name: string; diameterCm: number; basePrice: number };
type MenuResponse = { categories: Category[]; sizes: PizzaSize[] };
type EditorState = {
  id: number;
  name: string;
  description: string;
  basePrice: string;
  imageUrl: string;
  imageUrl2: string;
  active: boolean;
  visibleInPos: boolean;
  featured: boolean;
  type: ProductType;
};
type CreateState = { categorySlug: string; name: string; description: string; basePrice: string };
type ComboState = {
  id?: number;
  name: string;
  description: string;
  discountAmount: string;
  imageUrl: string;
  imageUrl2: string;
  pizzaQuantity: number;
  pizzaSizeIds: number[];
  pizzaFlavorIds: number[];
  snackQuantity: number;
  snackProductIds: number[];
  beverageQuantity: number;
  beverageProductIds: number[];
};

function formatCOP(value: number | null | undefined) {
  if (value == null) return "Sin precio";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function toggleId(values: number[], id: number) {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
}


async function uploadStoredProductImage(
  productId: number,
  slot: ProductImageSlot,
  file: File,
) {
  const form = new FormData();
  form.append("productId", String(productId));
  form.append("slot", slot);
  form.append("file", file);

  const response = await fetch("/api/product-images", {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "No fue posible cargar la imagen.");
  }

  return String(result.url || "");
}

async function removeStoredProductImage(
  productId: number,
  slot: ProductImageSlot,
) {
  const response = await fetch("/api/product-images", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, slot }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "No fue posible quitar la imagen.");
  }
}

function PendingProductImageControl({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="rounded-[16px] border border-neutral-200 bg-[#faf9f7] p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-neutral-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <b className="alento-ui-control block text-neutral-900">{label}</b>
          <span className="alento-ui-micro mt-1 block truncate text-neutral-500">
            {file ? file.name : "JPG, PNG o WebP · máximo 8 MB"}
          </span>
          <label className="alento-ui-control mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 font-bold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50">
            <Upload className="h-4 w-4" strokeWidth={2.2} />
            {file ? "Cambiar archivo" : "Seleccionar imagen"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => onChange(event.target.files?.[0] ?? null)}
            />
          </label>
          {file && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="alento-ui-label ml-2 rounded-lg px-2 py-2 font-bold text-red-600 hover:bg-red-50"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ExistingProductImageControl({
  label,
  productId,
  slot,
  url,
  busy,
  onUpload,
  onRemove,
}: {
  label: string;
  productId: number;
  slot: ProductImageSlot;
  url: string;
  busy: boolean;
  onUpload: (productId: number, slot: ProductImageSlot, file: File) => void;
  onRemove: (productId: number, slot: ProductImageSlot) => void;
}) {
  const internal = url.startsWith("/api/product-images/");

  return (
    <div className="rounded-[16px] border border-neutral-200 bg-[#faf9f7] p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-neutral-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <b className="alento-ui-control text-neutral-900">{label}</b>
            {url && (
              <span
                className={
                  "alento-ui-micro rounded-full border px-2 py-1 font-bold uppercase " +
                  (internal
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700")
                }
              >
                {internal ? "Guardada en Alentó" : "Imagen externa actual"}
              </span>
            )}
          </div>
          <span className="alento-ui-micro mt-1 block text-neutral-500">
            {url
              ? internal
                ? "Esta es la imagen oficial almacenada por Alentó."
                : "Se seguirá usando hasta que cargues una imagen oficial."
              : "Sin imagen cargada."}
          </span>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label
              className={
                "alento-ui-control inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-bold transition " +
                (busy
                  ? "cursor-wait border-neutral-200 bg-neutral-100 text-neutral-400"
                  : "cursor-pointer border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50")
              }
            >
              <Upload className="h-4 w-4" strokeWidth={2.2} />
              {busy ? "Cargando..." : url ? "Reemplazar imagen" : "Cargar imagen"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUpload(productId, slot, file);
                  event.currentTarget.value = "";
                }}
              />
            </label>

            {url && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(productId, slot)}
                className="alento-ui-control inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-2 font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.1} />
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const [data, setData] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const [imageFeedback, setImageFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const [createImageFiles, setCreateImageFiles] = useState<{ MAIN: File | null; SECONDARY: File | null }>({ MAIN: null, SECONDARY: null });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [comboState, setComboState] = useState<ComboState | null>(null);
  const [comboImageFiles, setComboImageFiles] = useState<{ MAIN: File | null; SECONDARY: File | null }>({ MAIN: null, SECONDARY: null });
  const [savingCombo, setSavingCombo] = useState(false);
  const [comboError, setComboError] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [draggingProductId, setDraggingProductId] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [savingToggle, setSavingToggle] = useState<"active" | "visibleInPos" | "featured" | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<number | null>(null);
  const [savingCategoryOrder, setSavingCategoryOrder] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState<{ id?: number; name: string; active: boolean } | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null);

  async function loadMenu(preserveCategory = true) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/menu-admin", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible cargar el menú.");
      const categories = [...(result.categories ?? [])].sort((a: Category, b: Category) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"),
      );
      setData({ categories, sizes: result.sizes ?? [] });
      if (!preserveCategory || activeCategoryId == null || !categories.some((category: Category) => category.id === activeCategoryId)) {
        setActiveCategoryId(categories[0]?.id ?? null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el menú.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMenu(false);
  }, []);

  const activeCategory = useMemo(
    () => data?.categories.find((category) => category.id === activeCategoryId) ?? data?.categories[0],
    [data, activeCategoryId],
  );

  const totalProducts = useMemo(
    () => data?.categories.filter((category) => category.slug !== "destacados").reduce((sum, category) => sum + category.products.length, 0) ?? 0,
    [data],
  );

  const minPizzaSizePrice = useMemo(() => {
    if (!data?.sizes?.length) return 0;
    return Math.min(...data.sizes.map((size) => size.basePrice));
  }, [data]);

  const visibleProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    const products = activeCategory?.products ?? [];
    if (!value) return products;
    return products.filter((product) => product.name.toLowerCase().includes(value) || product.description?.toLowerCase().includes(value));
  }, [activeCategory, query]);

  const pizzas = useMemo(() => {
    const category = data?.categories.find((item) => item.slug === "pizzas");
    return (category?.products ?? []).filter((product) => product.type === "PIZZA_SINGLE" && product.active);
  }, [data]);

  const snacks = useMemo(() => {
    const category = data?.categories.find((item) => item.slug === "antojos");
    return (category?.products ?? []).filter((product) => product.active);
  }, [data]);

  const beverages = useMemo(() => {
    const category = data?.categories.find((item) => item.slug === "bebidas");
    return (category?.products ?? []).filter((product) => product.active);
  }, [data]);

  function displayProductPrice(product: Product) {
    if (product.type === "PIZZA_SINGLE") return `Desde ${formatCOP(minPizzaSizePrice + (product.basePrice ?? 0))}`;
    if (product.type === "PIZZA_TWO_FLAVORS") return "Precio según sabores";
    if (product.type === "COMBO" && product.comboFinalMin != null && product.comboFinalMax != null) {
      return product.comboFinalMin === product.comboFinalMax ? formatCOP(product.comboFinalMin) : `Desde ${formatCOP(product.comboFinalMin)}`;
    }
    return formatCOP(product.basePrice);
  }

  function applyProductImageUrl(
    productId: number,
    slot: ProductImageSlot,
    url: string,
  ) {
    const field = slot === "MAIN" ? "imageUrl" : "imageUrl2";

    setData((current) =>
      current
        ? {
            ...current,
            categories: current.categories.map((category) => ({
              ...category,
              products: category.products.map((product) =>
                product.id === productId ? { ...product, [field]: url || null } : product,
              ),
            })),
          }
        : current,
    );

    setEditor((current) =>
      current?.id === productId ? { ...current, [field]: url } : current,
    );
    setComboState((current) =>
      current?.id === productId ? { ...current, [field]: url } : current,
    );
    setSelectedProduct((current) =>
      current?.id === productId ? { ...current, [field]: url || null } : current,
    );
  }

  async function handleProductImageUpload(
    productId: number,
    slot: ProductImageSlot,
    file: File,
  ) {
    const key = `${productId}:${slot}`;
    setImageBusy(key);
    setImageFeedback(null);
    setError("");
    setComboError("");

    try {
      const url = await uploadStoredProductImage(productId, slot, file);
      applyProductImageUrl(productId, slot, url);
      const message =
        slot === "MAIN"
          ? "Imagen principal cargada y guardada en Alentó."
          : "Imagen secundaria cargada y guardada en Alentó.";
      if (comboState?.id === productId) {
        setNotice(message);
      } else {
        setImageFeedback({ tone: "success", text: message });
      }
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "No fue posible cargar la imagen.";
      if (comboState?.id === productId) setComboError(message);
      else setImageFeedback({ tone: "error", text: message });
    } finally {
      setImageBusy(null);
    }
  }

  async function handleProductImageRemove(
    productId: number,
    slot: ProductImageSlot,
  ) {
    const key = `${productId}:${slot}`;
    setImageBusy(key);
    setError("");
    setComboError("");

    try {
      await removeStoredProductImage(productId, slot);
      applyProductImageUrl(productId, slot, "");
      if (comboState?.id === productId) {
        setNotice("Imagen retirada del producto.");
      } else {
        setImageFeedback({ tone: "success", text: "Imagen retirada del producto." });
      }
    } catch (removeError) {
      const message =
        removeError instanceof Error
          ? removeError.message
          : "No fue posible quitar la imagen.";
      if (comboState?.id === productId) setComboError(message);
      else setImageFeedback({ tone: "error", text: message });
    } finally {
      setImageBusy(null);
    }
  }

  async function uploadPendingProductImages(
    productId: number,
    files: { MAIN: File | null; SECONDARY: File | null },
  ) {
    if (files.MAIN) {
      await uploadStoredProductImage(productId, "MAIN", files.MAIN);
    }
    if (files.SECONDARY) {
      await uploadStoredProductImage(productId, "SECONDARY", files.SECONDARY);
    }
  }

  function openEditor(product: Product) {
    setImageFeedback(null);
    setEditor({
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      basePrice: product.basePrice == null ? "" : String(product.basePrice),
      imageUrl: product.imageUrl ?? "",
      imageUrl2: product.imageUrl2 ?? "",
      active: product.active,
      visibleInPos: product.visibleInPos,
      featured: product.featured,
      type: product.type,
    });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/menu-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editor.id,
          name: editor.name,
          description: editor.description,
          basePrice: editor.basePrice,
          imageUrl: editor.imageUrl,
          imageUrl2: editor.imageUrl2,
          active: editor.active,
          visibleInPos: editor.visibleInPos,
          featured: editor.featured,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el producto.");
      setEditor(null);
      setNotice("Producto actualizado correctamente.");
      await loadMenu();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function quickToggle(product: Product, field: "active" | "visibleInPos" | "featured") {
    const nextValue = !product[field];
    setError("");
    setSavingToggle(field);

    try {
      const response = await fetch("/api/menu-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, [field]: nextValue }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible actualizar el producto.");

      const updatedProduct: Product = { ...product, [field]: nextValue };

      setSelectedProduct((current) =>
        current?.id === product.id ? { ...current, [field]: nextValue } : current,
      );

      setData((current) => {
        if (!current) return current;

        return {
          ...current,
          categories: current.categories.map((category) => {
            if (category.slug === "destacados" && field === "featured") {
              if (nextValue) {
                const exists = category.products.some((item) => item.id === product.id);
                return {
                  ...category,
                  products: exists
                    ? category.products.map((item) => item.id === product.id ? updatedProduct : item)
                    : [...category.products, updatedProduct].sort(
                        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"),
                      ),
                };
              }

              return {
                ...category,
                products: category.products.filter((item) => item.id !== product.id),
              };
            }

            return {
              ...category,
              products: category.products.map((item) =>
                item.id === product.id ? { ...item, [field]: nextValue } : item,
              ),
            };
          }),
        };
      });
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "No fue posible actualizar el producto.");
    } finally {
      setSavingToggle(null);
    }
  }

  async function persistProductOrder(category: Category, productIds: number[]) {
    setSavingOrder(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorderProducts",
          categoryId: category.id,
          productIds,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el orden.");

      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          categories: current.categories.map((item) => {
            if (item.id !== category.id) return item;
            const byId = new Map(item.products.map((product) => [product.id, product] as const));
            return {
              ...item,
              products: productIds.map((id, index) => ({
                ...byId.get(id)!,
                sortOrder: index,
              })),
            };
          }),
        };
      });

      setNotice("Orden de productos actualizado.");
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "No fue posible guardar el orden.");
      await loadMenu();
    } finally {
      setSavingOrder(false);
    }
  }

  function moveProductBefore(targetProductId: number) {
    if (!activeCategory || draggingProductId == null || draggingProductId === targetProductId) return;
    if (query.trim()) return;
    const current = [...activeCategory.products];
    const fromIndex = current.findIndex((product) => product.id === draggingProductId);
    const toIndex = current.findIndex((product) => product.id === targetProductId);

    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);

    const productIds = current.map((product) => product.id);

    setData((state) => {
      if (!state) return state;
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === activeCategory.id
            ? {
                ...category,
                products: current.map((product, index) => ({ ...product, sortOrder: index })),
              }
            : category,
        ),
      };
    });

    void persistProductOrder(activeCategory, productIds);
  }

  async function persistCategoryOrder(categoryIds: number[]) {
    setSavingCategoryOrder(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorderCategories", categoryIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el orden de categorías.");

      setData((current) => {
        if (!current) return current;
        const byId = new Map(current.categories.map((category) => [category.id, category] as const));
        return {
          ...current,
          categories: categoryIds.map((id, index) => ({
            ...byId.get(id)!,
            sortOrder: index,
          })),
        };
      });

      setNotice("Orden de categorías actualizado.");
    } catch (categoryOrderError) {
      setError(categoryOrderError instanceof Error ? categoryOrderError.message : "No fue posible guardar el orden de categorías.");
      await loadMenu();
    } finally {
      setSavingCategoryOrder(false);
    }
  }

  function moveCategoryBefore(targetCategoryId: number) {
    if (!data || draggingCategoryId == null || draggingCategoryId === targetCategoryId) return;

    const current = [...data.categories];
    const fromIndex = current.findIndex((category) => category.id === draggingCategoryId);
    const toIndex = current.findIndex((category) => category.id === targetCategoryId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);

    setData({
      ...data,
      categories: current.map((category, index) => ({ ...category, sortOrder: index })),
    });

    void persistCategoryOrder(current.map((category) => category.id));
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryEditor?.name.trim()) return setCategoryError("El nombre de la categoría es obligatorio.");

    setSavingCategory(true);
    setCategoryError("");
    try {
      const editing = categoryEditor.id != null;
      const response = await fetch("/api/menu-admin", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? {
                action: "updateCategory",
                categoryId: categoryEditor.id,
                name: categoryEditor.name,
                active: categoryEditor.active,
              }
            : {
                action: "createCategory",
                name: categoryEditor.name,
                active: categoryEditor.active,
              },
        ),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar la categoría.");

      const categoryId = result.category?.id as number | undefined;
      setCategoryEditor(null);
      setNotice(editing ? "Categoría actualizada correctamente." : "Categoría creada correctamente.");
      await loadMenu(false);
      if (categoryId) setActiveCategoryId(categoryId);
    } catch (categorySaveError) {
      setCategoryError(categorySaveError instanceof Error ? categorySaveError.message : "No fue posible guardar la categoría.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function deleteCategory(category: Category) {
    setSavingCategory(true);
    setCategoryError("");
    try {
      const response = await fetch("/api/menu-admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteCategory", categoryId: category.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible eliminar la categoría.");

      setDeleteCategoryTarget(null);
      setCategoryEditor(null);
      setNotice(`${category.name} fue eliminada.`);
      await loadMenu(false);
    } catch (categoryDeleteError) {
      setDeleteCategoryTarget(null);
      setError(categoryDeleteError instanceof Error ? categoryDeleteError.message : "No fue posible eliminar la categoría.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function deleteProduct(product: Product) {
    setDeletingProductId(product.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/menu-admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible eliminar el producto.");
      setNotice(`${product.name} fue eliminado.`);
      setSelectedProduct(null);
      setDeleteTarget(null);
      await loadMenu();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el producto.");
    } finally {
      setDeletingProductId(null);
    }
  }

  function startCreateProduct(category: Category) {
    setCreateError("");
    setCreateImageFiles({ MAIN: null, SECONDARY: null });
    setCreateState({
      categorySlug: category.slug,
      name: "",
      description: "",
      basePrice: category.slug === "ingredientes" ? "5000" : "",
    });
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createState) return;
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createProduct", ...createState }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible crear el producto.");

      let imageWarning = "";
      try {
        await uploadPendingProductImages(Number(result.product?.id), createImageFiles);
      } catch (uploadError) {
        imageWarning =
          uploadError instanceof Error
            ? uploadError.message
            : "No fue posible cargar una de las imágenes.";
      }

      setCreateState(null);
      setCreateImageFiles({ MAIN: null, SECONDARY: null });
      setNotice(
        imageWarning
          ? `Producto creado. ${imageWarning} Puedes cargar la imagen al editarlo.`
          : "Producto creado correctamente.",
      );
      await loadMenu();
    } catch (createProductError) {
      setCreateError(createProductError instanceof Error ? createProductError.message : "No fue posible crear el producto.");
    } finally {
      setCreating(false);
    }
  }

  function startCombo(product?: Product) {
    setComboError("");
    setComboImageFiles({ MAIN: null, SECONDARY: null });
    const pizzaRule = product?.comboPizzaRules?.[0];
    const snackGroup = product?.comboGroups?.find((group) => group.kind === "ANTOJO");
    const beverageGroup = product?.comboGroups?.find((group) => group.kind === "BEBIDA");
    setComboState({
      id: product?.id,
      name: product?.name ?? "",
      description: product?.description ?? "",
      discountAmount: product?.comboDiscount == null ? "" : String(product.comboDiscount),
      imageUrl: product?.imageUrl ?? "",
      imageUrl2: product?.imageUrl2 ?? "",
      pizzaQuantity: pizzaRule?.quantity ?? 0,
      pizzaSizeIds: pizzaRule?.sizeIds ?? [],
      pizzaFlavorIds: pizzaRule?.flavorIds ?? [],
      snackQuantity: snackGroup?.minSelections ?? 0,
      snackProductIds: snackGroup?.options.map((option) => option.productId) ?? [],
      beverageQuantity: beverageGroup?.minSelections ?? 0,
      beverageProductIds: beverageGroup?.options.map((option) => option.productId) ?? [],
    });
  }

  const comboPreview = useMemo(() => {
    if (!comboState) return { min: 0, max: 0, discount: 0, finalMin: 0, finalMax: 0 };
    let min = 0;
    let max = 0;

    if (comboState.pizzaQuantity > 0 && comboState.pizzaSizeIds.length && comboState.pizzaFlavorIds.length) {
      const selectedSizes = (data?.sizes ?? []).filter((size) => comboState.pizzaSizeIds.includes(size.id));
      const selectedFlavors = pizzas.filter((pizza) => comboState.pizzaFlavorIds.includes(pizza.id));
      const sizePrices = selectedSizes.map((size) => size.basePrice);
      const flavorPrices = selectedFlavors.map((pizza) => pizza.basePrice ?? 0);
      if (sizePrices.length && flavorPrices.length) {
        min += (Math.min(...sizePrices) + Math.min(...flavorPrices)) * comboState.pizzaQuantity;
        max += (Math.max(...sizePrices) + Math.max(...flavorPrices)) * comboState.pizzaQuantity;
      }
    }

    if (comboState.snackQuantity > 0 && comboState.snackProductIds.length) {
      const prices = snacks.filter((item) => comboState.snackProductIds.includes(item.id)).map((item) => item.basePrice ?? 0);
      if (prices.length) {
        min += Math.min(...prices) * comboState.snackQuantity;
        max += Math.max(...prices) * comboState.snackQuantity;
      }
    }

    if (comboState.beverageQuantity > 0 && comboState.beverageProductIds.length) {
      const prices = beverages.filter((item) => comboState.beverageProductIds.includes(item.id)).map((item) => item.basePrice ?? 0);
      if (prices.length) {
        min += Math.min(...prices) * comboState.beverageQuantity;
        max += Math.max(...prices) * comboState.beverageQuantity;
      }
    }

    const discount = Math.max(0, Number(comboState.discountAmount) || 0);
    return { min, max, discount, finalMin: Math.max(0, min - discount), finalMax: Math.max(0, max - discount) };
  }, [comboState, data, pizzas, snacks, beverages]);

  async function saveCombo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comboState) return;
    setSavingCombo(true);
    setComboError("");
    try {
      const response = await fetch("/api/menu-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: comboState.id ? "saveCombo" : "createCombo",
          comboProductId: comboState.id,
          name: comboState.name,
          description: comboState.description,
          imageUrl: comboState.imageUrl,
          imageUrl2: comboState.imageUrl2,
          discountAmount: comboState.discountAmount,
          pizzaQuantity: comboState.pizzaQuantity,
          pizzaSizeIds: comboState.pizzaSizeIds,
          pizzaFlavorIds: comboState.pizzaFlavorIds,
          snackQuantity: comboState.snackQuantity,
          snackProductIds: comboState.snackProductIds,
          beverageQuantity: comboState.beverageQuantity,
          beverageProductIds: comboState.beverageProductIds,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el combo.");

      let imageWarning = "";
      if (!comboState.id) {
        try {
          await uploadPendingProductImages(Number(result.combo?.id), comboImageFiles);
        } catch (uploadError) {
          imageWarning =
            uploadError instanceof Error
              ? uploadError.message
              : "No fue posible cargar una de las imágenes.";
        }
      }

      setComboState(null);
      setComboImageFiles({ MAIN: null, SECONDARY: null });
      setNotice(
        imageWarning
          ? `Combo creado. ${imageWarning} Puedes cargar la imagen al editarlo.`
          : comboState.id
            ? "Combo actualizado correctamente."
            : "Combo creado correctamente.",
      );
      await loadMenu(false);
    } catch (comboSaveError) {
      setComboError(comboSaveError instanceof Error ? comboSaveError.message : "No fue posible guardar el combo.");
    } finally {
      setSavingCombo(false);
    }
  }

  if (loading && !data) {
    return <main className="p-6 lg:p-8"><div className="alento-card mx-auto max-w-7xl rounded-[28px] p-8">Cargando administración del menú...</div></main>;
  }

  return (
    <main className="min-h-screen p-3 sm:p-4 lg:p-5 xl:p-5">
      <div className="w-full space-y-4">
        <section className="relative min-h-[116px] w-full overflow-hidden rounded-[24px] border border-black/5 bg-[#0a0a0b] text-white shadow-[0_14px_36px_rgba(20,16,14,.11)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(226,26,34,.55),transparent_25%),radial-gradient(circle_at_68%_100%,rgba(132,12,16,.36),transparent_34%),linear-gradient(105deg,#111319_0%,#101116_43%,#1a0b0d_67%,#5a090c_100%)]" />
          <div className="absolute inset-y-0 right-0 w-[46%] opacity-70 [background:linear-gradient(115deg,transparent_0%,rgba(255,255,255,.025)_28%,transparent_29%),repeating-linear-gradient(90deg,transparent_0_54px,rgba(255,255,255,.025)_55px_56px)]" />
          <div className="absolute right-[24%] top-[-18px] h-20 w-20 rounded-full bg-red-500/10 blur-2xl" />
          <div className="absolute right-[9%] top-[22px] h-[2px] w-[30%] bg-gradient-to-r from-transparent via-red-300/40 to-transparent" />

          <div className="relative flex min-h-[116px] flex-col justify-between gap-4 px-5 py-4 md:flex-row md:items-center md:px-6 xl:px-7">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="h-[2px] w-7 rounded-full bg-[var(--brand-red)]" />
                <p className="alento-ui-label uppercase tracking-[0.2em] text-white/55">
                  Administración
                </p>
              </div>
              <h1 className="alento-ui-hero-title mt-1.5">
                Menú
              </h1>
              <p className="alento-ui-hero-subtitle mt-1.5 text-white/60">
                Organiza categorías, productos y disponibilidad desde un solo lugar.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 self-end md:self-auto">
              <div className="flex h-[56px] w-[76px] shrink-0 flex-col items-center justify-center rounded-[16px] border border-white/14 bg-white/[0.08] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-sm">
                <span className="alento-ui-micro uppercase tracking-[0.14em] text-white/50">
                  Productos
                </span>
                <b className="alento-ui-metric mt-0.5 tabular-nums text-white">
                  {totalProducts}
                </b>
              </div>
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
        {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}

        <section className="space-y-3">
          <div className="alento-card rounded-[22px] p-2.5">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <div>
                <b className="text-[13px] font-semibold text-neutral-900">Categorías</b>
                <span className="ml-2 text-[11px] text-neutral-400">
                  {savingCategoryOrder
                    ? "Guardando orden..."
                    : "Arrastra para definir el orden del menú del cliente y POS"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCategoryError("");
                  setCategoryEditor({ name: "", active: true });
                }}
                aria-label="Nueva categoría"
                title="Nueva categoría"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-[0_8px_18px_rgba(17,17,19,.16)] transition hover:-translate-y-0.5 hover:bg-black"
              >
                <Plus className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              {data?.categories.map((category) => {
                const active = activeCategory?.id === category.id;
                return (
                  <div
                    key={category.id}
                    onDragOver={(event) => {
                      if (draggingCategoryId == null) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveCategoryBefore(category.id);
                      setDraggingCategoryId(null);
                    }}
                    className={`group relative flex min-w-0 items-center rounded-xl border transition ${active ? "border-black bg-black text-white shadow-[0_6px_14px_rgba(0,0,0,.12)]" : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300"} ${draggingCategoryId === category.id ? "opacity-45" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategoryId(category.id);
                        setQuery("");
                        setNotice("");
                      }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-left"
                    >
                      <span className="truncate text-[14px] font-semibold leading-5">{category.name}</span>
                      <span className={`inline-flex min-w-7 shrink-0 items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold leading-none tabular-nums ${active ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-600"}`}>
                        {category.products.length}
                      </span>
                    </button>

                    <span
                      role="button"
                      tabIndex={0}
                      draggable={!savingCategoryOrder}
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        event.stopPropagation();
                        if (savingCategoryOrder) {
                          event.preventDefault();
                          return;
                        }
                        setDraggingCategoryId(category.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(category.id));
                      }}
                      onDragEnd={() => setDraggingCategoryId(null)}
                      className={`mr-2 flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-[14px] font-semibold transition active:cursor-grabbing ${active ? "bg-white/10 text-white/70" : "bg-neutral-100 text-neutral-500"}`}
                      title="Arrastrar categoría"
                    >
                      ⋮⋮
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="alento-card rounded-[22px] p-3.5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[20px] font-black tracking-[-0.02em] text-neutral-950">{activeCategory?.name ?? "Productos"}</h2>
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-bold text-neutral-500">
                      {activeCategory?.products.length ?? 0}
                    </span>
                  </div>
                  {activeCategory && (
                    <p className="mt-1 text-[10.5px] text-neutral-400">
                      {query.trim()
                        ? "Quita la búsqueda para reorganizar productos."
                        : savingOrder
                          ? "Guardando nuevo orden..."
                          : activeCategory.slug === "destacados"
                            ? "Arrastra desde ⋮⋮ para reorganizar Destacados."
                            : "Arrastra desde ⋮⋮ para reorganizar el menú del cliente y POS."}
                    </p>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="relative min-w-0 flex-1 sm:w-[300px] sm:flex-none">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-neutral-400">⌕</span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="alento-input h-11 w-full rounded-xl pl-10 pr-4 text-sm sm:w-[300px]"
                      placeholder="Buscar producto..."
                    />
                  </label>

                  {activeCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryError("");
                        setCategoryEditor({ id: activeCategory.id, name: activeCategory.name, active: activeCategory.active });
                      }}
                      aria-label="Editar categoría"
                      title="Editar categoría"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2.1} />
                    </button>
                  )}

                  {activeCategory && !["destacados", "combos"].includes(activeCategory.slug) && (
                    <button
                      type="button"
                      onClick={() => startCreateProduct(activeCategory)}
                      aria-label={activeCategory.slug === "ingredientes" ? "Nuevo ingrediente" : "Nuevo producto"}
                      title={activeCategory.slug === "ingredientes" ? "Nuevo ingrediente" : "Nuevo producto"}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-[0_8px_18px_rgba(17,17,19,.16)] transition hover:-translate-y-0.5 hover:bg-black"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                  )}

                  {activeCategory?.slug === "combos" && (
                    <button
                      type="button"
                      onClick={() => startCombo()}
                      aria-label="Nuevo combo"
                      title="Nuevo combo"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-red)] text-white shadow-[0_8px_18px_rgba(226,26,34,.18)] transition hover:-translate-y-0.5 hover:brightness-105"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              {visibleProducts.map((product) => (
                <article
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!savingOrder && draggingProductId == null) setSelectedProduct(product);
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && !savingOrder) {
                      event.preventDefault();
                      setSelectedProduct(product);
                    }
                  }}
                  onDragOver={(event) => {
                    if (draggingProductId == null || query.trim()) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveProductBefore(product.id);
                    setDraggingProductId(null);
                  }}
                  className={`alento-product-card group relative cursor-pointer ${draggingProductId === product.id ? "opacity-45 ring-2 ring-black/10" : ""}`}
                >
                  <div className="alento-product-card-media">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="alento-product-card-image"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[linear-gradient(145deg,#f7f6f3,#ece8e2)] text-5xl">🍕</div>
                    )}

                    <div className="absolute left-2.5 top-2.5 z-10 flex flex-wrap gap-1.5">
                      <span className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold uppercase leading-none shadow-sm ${product.active ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-800 bg-neutral-900 text-white"}`}>
                        {product.active ? "Activo" : "Inactivo"}
                      </span>
                      {product.featured && (
                        <span className="rounded-full border border-red-600 bg-[var(--brand-red)] px-2.5 py-1.5 text-[11px] font-semibold uppercase leading-none text-white shadow-sm">
                          Destacado
                        </span>
                      )}
                    </div>

                    {!query.trim() && (
                      <div
                        role="button"
                        tabIndex={0}
                        draggable={!savingOrder}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          if (savingOrder) {
                            event.preventDefault();
                            return;
                          }
                          setDraggingProductId(product.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", String(product.id));
                        }}
                        onDragEnd={(event) => {
                          event.stopPropagation();
                          setDraggingProductId(null);
                        }}
                        className="absolute right-2.5 top-2.5 z-20 flex h-9 w-9 cursor-grab items-center justify-center rounded-xl border border-white bg-neutral-950 text-[16px] font-black text-white shadow-md transition hover:bg-neutral-800 active:cursor-grabbing"
                        title="Arrastrar para reordenar"
                      >
                        ⋮⋮
                      </div>
                    )}
                  </div>

                  <div className="alento-product-card-body">
                    <h3 className="alento-product-card-title">
                      {product.name}
                    </h3>

                    <div className="alento-product-card-footer">
                      <span className="alento-product-card-price">
                        {displayProductPrice(product)}
                      </span>
                      <span className="alento-product-card-action">
                        +
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {visibleProducts.length === 0 && <div className="alento-card rounded-[24px] p-8 text-center text-sm text-neutral-400">No hay productos para mostrar.</div>}
          </div>
        </section>
      </div>

      {categoryEditor && (
        <div
          className="fixed inset-0 z-[135] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingCategory) setCategoryEditor(null);
          }}
        >
          <form
            onSubmit={saveCategory}
            className="w-full max-w-[620px] overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_30px_90px_rgba(0,0,0,.28)]"
          >
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-[var(--brand-red)] bg-[radial-gradient(circle_at_92%_10%,rgba(229,28,17,.22),transparent_32%),linear-gradient(135deg,#09090a,#191617)] px-6 py-4.5 text-white">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  {categoryEditor.id ? "Editar categoría" : "Nueva categoría"}
                </p>
                <h2 className="mt-1 text-[25px] font-semibold tracking-[-0.02em] text-white">
                  {categoryEditor.id ? categoryEditor.name || "Categoría" : "Crear categoría"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !savingCategory && setCategoryEditor(null)}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-[11px] font-semibold text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5">
              <label className="block">
                <span className="text-[12px] font-semibold text-neutral-800">Nombre de la categoría</span>
                <input
                  autoFocus
                  value={categoryEditor.name}
                  onChange={(event) => setCategoryEditor({ ...categoryEditor, name: event.target.value })}
                  className="alento-input mt-2 w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="Ej. Postres"
                />
              </label>

              <div className={`mt-4 rounded-[22px] border p-4 transition-all ${categoryEditor.active
                ? "border-emerald-200 bg-[linear-gradient(145deg,#f8fffb,#ecfdf5)]"
                : "border-neutral-200 bg-[linear-gradient(145deg,#fff,#f7f7f7)]"
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black ${categoryEditor.active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-neutral-100 text-neutral-500"
                    }`}>
                      {categoryEditor.active ? "•" : "○"}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[.11em] text-neutral-400">Categoría pública</p>
                      <h3 className="mt-1 text-[15px] font-black text-neutral-950">
                        {categoryEditor.active ? "Activa" : "Desactivada"}
                      </h3>
                      <p className="mt-1 text-[10px] leading-5 text-neutral-500">
                        {categoryEditor.active
                          ? "La categoría aparece como pestaña en el menú público."
                          : "La categoría desaparece del selector, pero sus productos conservan su estado y pueden seguir apareciendo en Destacados."}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-pressed={categoryEditor.active}
                    onClick={() => setCategoryEditor({ ...categoryEditor, active: !categoryEditor.active })}
                    className={`relative h-8 w-14 shrink-0 rounded-full border transition-all duration-200 ${categoryEditor.active
                      ? "border-emerald-500 bg-emerald-500 shadow-[0_8px_18px_rgba(16,185,129,.22)]"
                      : "border-neutral-300 bg-neutral-200"
                    }`}
                  >
                    <span
                      className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-[0_3px_10px_rgba(0,0,0,.18)] transition-all duration-200 ${categoryEditor.active
                        ? "left-[25px]"
                        : "left-[3px]"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-3 border-t border-black/5 pt-3">
                  <p className="text-[11px] leading-4 text-neutral-500">
                    Desactivar la categoría no desactiva sus productos. Por ejemplo, puedes ocultar “Combos” del selector y mantener combos activos dentro de “Destacados”.
                  </p>
                </div>
              </div>

              {categoryEditor.id && (
                <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#faf9f7] p-4">
                  <p className="text-[11px] leading-5 text-neutral-600">
                    Los productos vinculados permanecen en esta categoría y mostrarán automáticamente el nuevo nombre.
                  </p>

                  {(() => {
                    const category = data?.categories.find((item) => item.id === categoryEditor.id);
                    const protectedCategory = category ? ["destacados", "pizzas", "antojos", "bebidas", "combos", "ingredientes"].includes(category.slug) : false;
                    if (!category) return null;
                    return (
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-200 pt-3">
                        <div>
                          <b className="text-[11px] text-neutral-800">Eliminar categoría</b>
                          <p className="mt-0.5 text-[10px] text-neutral-500">
                            {protectedCategory
                              ? "Categoría base del sistema: puede renombrarse y moverse, pero no eliminarse."
                              : category.products.length
                                ? `Tiene ${category.products.length} producto(s) vinculados.`
                                : "Disponible porque no tiene productos vinculados."}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={protectedCategory || category.products.length > 0 || savingCategory}
                          onClick={() => setDeleteCategoryTarget(category)}
                          className="shrink-0 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-[11px] font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {categoryError && (
                <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] text-red-700">
                  {categoryError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 bg-[#faf9f7] px-5 py-4">
              <button
                type="button"
                onClick={() => setCategoryEditor(null)}
                disabled={savingCategory}
                className="h-11 rounded-xl border border-neutral-200 bg-white px-5 text-[12px] font-semibold text-neutral-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingCategory}
                className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {savingCategory ? "Guardando..." : categoryEditor.id ? "Guardar cambios" : "Crear categoría"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteCategoryTarget && (
        <ActionConfirmModal
          variant="danger"
          eyebrow="Eliminar categoría"
          title={`Eliminar ${deleteCategoryTarget.name}`}
          description="Esta acción no se puede deshacer."
          detail="La categoría solo se eliminará si no tiene productos vinculados."
          confirmLabel={savingCategory ? "Eliminando..." : "Eliminar categoría"}
          cancelLabel="Cancelar"
          busy={savingCategory}
          onClose={() => {
            if (!savingCategory) setDeleteCategoryTarget(null);
          }}
          onConfirm={() => void deleteCategory(deleteCategoryTarget)}
        />
      )}

      {selectedProduct && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <div className="w-full max-w-[1040px] overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-[0_30px_90px_rgba(0,0,0,.28)]">
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-[var(--brand-red)] bg-[radial-gradient(circle_at_92%_10%,rgba(229,28,17,.22),transparent_32%),linear-gradient(135deg,#09090a,#191617)] px-6 py-4.5 text-white">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Administrar producto</p>
                <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.025em] text-white">{selectedProduct.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase text-white/80">{selectedProduct.type}</span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                    {data?.categories.find((category) => category.id === selectedProduct.categoryId)?.name ?? "Producto"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-white/15"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-5 bg-[#f5f3f0] p-5 md:grid-cols-[310px_minmax(0,1fr)] md:p-6">
              <div className="min-w-0">
                <div className="overflow-hidden rounded-[24px] border-[5px] border-white bg-white shadow-[0_14px_34px_rgba(28,23,20,.10)]">
                  <div className="aspect-square bg-white p-2">
                    {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-[18px] bg-[#f7f6f3] text-5xl">🍕</div>
                    )}
                  </div>

                  <div className="bg-[linear-gradient(135deg,#111112,#1b1819)] p-4 text-white">
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/50">Precio actual</span>
                    <b className="mt-1 block text-[22px] font-semibold leading-7 tracking-[-0.02em] text-white">
                      {displayProductPrice(selectedProduct)}
                    </b>
                    {selectedProduct.description && (
                      <p className="mt-2 line-clamp-3 text-[11px] font-normal leading-[17px] text-white/65">
                        {selectedProduct.description}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const product = selectedProduct;
                    setSelectedProduct(null);
                    openEditor(product);
                  }}
                  className="mt-3 flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-neutral-300 hover:shadow-md"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-950 text-[14px] font-medium text-white">✎</span>
                    <span>
                      <b className="block text-[12px] font-semibold text-neutral-950">Editar información</b>
                      <span className="mt-0.5 block text-[10px] text-neutral-500">Nombre, precio, descripción e imágenes.</span>
                    </span>
                  </span>
                  <span className="text-lg text-neutral-300">›</span>
                </button>
              </div>

              <div className="min-w-0">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Control del producto</p>
                    <h3 className="mt-1 text-[21px] font-semibold tracking-[-0.02em] text-neutral-950">Estado y visibilidad</h3>
                    <p className="mt-1 text-[11px] leading-4 text-neutral-500">Los cambios se guardan al instante sin cerrar esta ventana.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      field: "active" as const,
                      label: "Activo",
                      description: "Disponible para operar.",
                      enabled: selectedProduct.active,
                      disabled: false,
                      shell: "border-emerald-200 bg-[linear-gradient(160deg,#ffffff,#ecfdf5)]",
                      icon: "●",
                      iconClass: "bg-emerald-100 text-emerald-700",
                      switchClass: "bg-emerald-500",
                    },
                    {
                      field: "visibleInPos" as const,
                      label: "Visible en POS",
                      description: "Aparece en el catálogo.",
                      enabled: selectedProduct.visibleInPos,
                      disabled: selectedProduct.type === "MODIFIER",
                      shell: "border-sky-200 bg-[linear-gradient(160deg,#ffffff,#eff8ff)]",
                      icon: "POS",
                      iconClass: "bg-sky-100 text-sky-700",
                      switchClass: "bg-sky-500",
                    },
                    {
                      field: "featured" as const,
                      label: "Destacado",
                      description: "Aparece en Destacados.",
                      enabled: selectedProduct.featured,
                      disabled: selectedProduct.type === "MODIFIER",
                      shell: "border-amber-200 bg-[linear-gradient(160deg,#ffffff,#fff9e8)]",
                      icon: "★",
                      iconClass: "bg-amber-100 text-amber-700",
                      switchClass: "bg-amber-500",
                    },
                  ].map((option) => {
                    const busy = savingToggle === option.field;
                    return (
                      <div
                        key={option.field}
                        className={`relative overflow-hidden rounded-[20px] border p-4 shadow-[0_8px_20px_rgba(28,23,20,.04)] ${option.disabled ? "border-neutral-200 bg-neutral-100/75 opacity-55" : option.shell}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-[11px] font-semibold ${option.disabled ? "bg-neutral-200 text-neutral-500" : option.iconClass}`}>
                            {option.icon}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={option.enabled}
                            disabled={option.disabled || savingToggle !== null}
                            onClick={() => void quickToggle(selectedProduct, option.field)}
                            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed ${option.enabled && !option.disabled ? option.switchClass : "bg-neutral-300"} ${busy ? "opacity-60" : ""}`}
                            title={option.disabled ? "No disponible para este tipo de producto" : undefined}
                          >
                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${option.enabled ? "left-6" : "left-1"}`} />
                          </button>
                        </div>

                        <b className="mt-4 block text-[13px] font-semibold text-neutral-950">{option.label}</b>
                        <p className="mt-1 min-h-8 text-[10px] leading-4 text-neutral-500">{option.description}</p>
                        <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${option.enabled && !option.disabled ? "bg-white/80 text-neutral-700 shadow-sm" : "bg-neutral-200/70 text-neutral-500"}`}>
                          {option.disabled ? "No disponible" : option.enabled ? "Activado" : "Desactivado"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {selectedProduct.type === "COMBO" && (
                  <button
                    type="button"
                    onClick={() => {
                      const product = selectedProduct;
                      setSelectedProduct(null);
                      startCombo(product);
                    }}
                    className="mt-4 flex w-full items-center justify-between rounded-[20px] border border-red-200 bg-[linear-gradient(135deg,#ffffff,#fff3f3)] px-4 py-3.5 text-left shadow-[0_8px_20px_rgba(229,28,17,.05)] transition hover:border-red-300 hover:shadow-md"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-[17px] font-medium text-red-700">+</span>
                      <span>
                        <b className="block text-[13px] font-semibold text-neutral-950">Configurar combo</b>
                        <span className="mt-0.5 block text-[10px] text-neutral-500">Productos, cantidades, sabores, tamaños y descuento.</span>
                      </span>
                    </span>
                    <span className="text-xl text-red-300">›</span>
                  </button>
                )}

                <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-neutral-200 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[14px] font-medium text-red-600">×</span>
                    <div>
                      <b className="text-[12px] font-semibold text-neutral-900">Eliminar producto</b>
                      <p className="mt-0.5 text-[10px] leading-4 text-neutral-500">Solo si no tiene pedidos ni dependencias activas.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selectedProduct)}
                    className="shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editor && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setEditor(null);
          }}
        >
          <form
            onSubmit={saveProduct}
            className="flex max-h-[94vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-[0_30px_90px_rgba(0,0,0,.28)]"
          >
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-[var(--brand-red)] bg-[radial-gradient(circle_at_92%_10%,rgba(229,28,17,.22),transparent_32%),linear-gradient(135deg,#09090a,#191617)] px-6 py-4.5 text-white">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Editar producto</p>
                <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.025em] text-white">{editor.name}</h2>
                <span className="mt-2 inline-flex rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase text-white/75">
                  {editor.type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => !saving && setEditor(null)}
                className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
                disabled={saving}
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto bg-[#f5f3f0] p-5 md:p-6">
              <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
                <aside className="space-y-3">
                  <div className="overflow-hidden rounded-[24px] border-[5px] border-white bg-white shadow-[0_14px_34px_rgba(28,23,20,.09)]">
                    <div className="aspect-square bg-white p-2">
                      {editor.imageUrl ? (
                        <img
                          src={editor.imageUrl}
                          alt={editor.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-[18px] bg-[#f7f6f3] text-5xl">🍕</div>
                      )}
                    </div>
                    <div className="bg-[linear-gradient(135deg,#111112,#1b1819)] p-4 text-white">
                      <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-white/45">Vista principal</span>
                      <h3 className="mt-1 truncate text-[16px] font-medium leading-6">{editor.name || "Producto"}</h3>
                      <b className="mt-2 block text-[20px] font-semibold leading-6 tracking-[-0.02em]">
                        {formatCOP(Number(editor.basePrice) || 0)}
                      </b>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-neutral-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Imagen secundaria</p>
                        <p className="mt-0.5 text-[10px] text-neutral-500">Vista alternativa del producto.</p>
                      </div>
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-[#faf9f7]">
                        {editor.imageUrl2 ? (
                          <img src={editor.imageUrl2} alt="" className="h-full w-full object-contain p-1" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-neutral-300">Sin imagen</div>
                        )}
                      </div>
                    </div>
                  </div>
                </aside>

                <div className="min-w-0 space-y-4">
                  <section className="rounded-[22px] border border-neutral-200 bg-white p-4.5 shadow-sm">
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Información principal</p>
                      <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.015em] text-neutral-950">Datos que verá el cliente</h3>
                    </div>

                    <div className="grid gap-4">
                      <label className="space-y-1.5">
                        <span className="text-[12px] font-semibold text-neutral-800">Nombre del producto</span>
                        <input
                          value={editor.name}
                          onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                          className="alento-input h-12 w-full rounded-xl px-4 text-[14px]"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-[12px] font-semibold text-neutral-800">Descripción</span>
                        <textarea
                          value={editor.description}
                          onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                          className="alento-input min-h-[108px] w-full rounded-xl px-4 py-3 text-[13px] leading-5"
                          placeholder="Describe brevemente el producto."
                        />
                      </label>

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                        <label className="rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-3.5">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                            {editor.type === "PIZZA_SINGLE" ? "Valor del sabor" : "Precio base"}
                          </span>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[20px] font-medium text-neutral-400">$</span>
                            <input
                              value={editor.basePrice}
                              onChange={(event) => setEditor({ ...editor, basePrice: event.target.value })}
                              inputMode="numeric"
                              className="min-w-0 flex-1 bg-transparent text-[22px] font-semibold tracking-[-0.02em] text-neutral-950 outline-none"
                            />
                          </div>
                          <span className="mt-1 block text-[10px] text-neutral-400">
                            {formatCOP(Number(editor.basePrice) || 0)}
                          </span>
                        </label>

                        <div className="rounded-[18px] border border-neutral-200 bg-[#faf9f7] p-3.5">
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Tipo</span>
                          <b className="mt-3 block truncate text-[12px] font-semibold text-neutral-800">{editor.type}</b>
                          <span className="mt-1 block text-[10px] text-neutral-400">Configuración interna</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[22px] border border-neutral-200 bg-white p-4.5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Recursos visuales</p>
                        <h3 className="mt-1 text-[16px] font-semibold text-neutral-950">Imágenes del producto</h3>
                        <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                          Las imágenes nuevas se guardan en Alentó y reemplazan la URL externa como fuente oficial.
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        Almacenamiento propio
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <ExistingProductImageControl
                        label="Imagen principal"
                        productId={editor.id}
                        slot="MAIN"
                        url={editor.imageUrl}
                        busy={imageBusy === `${editor.id}:MAIN`}
                        onUpload={(productId, slot, file) =>
                          void handleProductImageUpload(productId, slot, file)
                        }
                        onRemove={(productId, slot) =>
                          void handleProductImageRemove(productId, slot)
                        }
                      />
                      <ExistingProductImageControl
                        label="Imagen secundaria"
                        productId={editor.id}
                        slot="SECONDARY"
                        url={editor.imageUrl2}
                        busy={imageBusy === `${editor.id}:SECONDARY`}
                        onUpload={(productId, slot, file) =>
                          void handleProductImageUpload(productId, slot, file)
                        }
                        onRemove={(productId, slot) =>
                          void handleProductImageRemove(productId, slot)
                        }
                      />
                    </div>

                    {imageFeedback && (
                      <p
                        className={
                          "alento-ui-control mt-3 rounded-xl border px-3 py-2 font-semibold " +
                          (imageFeedback.tone === "success"
                            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                            : "border-red-100 bg-red-50 text-red-700")
                        }
                      >
                        {imageFeedback.text}
                      </p>
                    )}

                    <p className="alento-ui-micro mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sky-700">
                      La carga o eliminación de imágenes se guarda inmediatamente. “Guardar cambios” aplica al nombre, descripción y precio.
                    </p>
                  </section>                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-white px-5 py-4">
              <p className="hidden text-[10px] text-neutral-400 sm:block">Los cambios se aplicarán al catálogo y al POS.</p>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  disabled={saving}
                  className="h-11 rounded-xl border border-neutral-200 bg-white px-5 text-[12px] font-semibold text-neutral-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="alento-red-glow h-11 rounded-xl bg-[var(--brand-red)] px-5 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {createState && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) setCreateState(null);
          }}
        >
          <form
            onSubmit={createProduct}
            className="flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-[0_30px_90px_rgba(0,0,0,.28)]"
          >
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-[var(--brand-red)] bg-[radial-gradient(circle_at_92%_10%,rgba(229,28,17,.22),transparent_32%),linear-gradient(135deg,#09090a,#191617)] px-6 py-4.5 text-white">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Nuevo producto</p>
                <h2 className="mt-1 text-[26px] font-black tracking-[-0.03em] text-white">Crear en {activeCategory?.name}</h2>
                <p className="mt-1 text-[11px] text-white/55">Completa la información básica para agregarlo al catálogo.</p>
              </div>
              <button
                type="button"
                onClick={() => !creating && setCreateState(null)}
                className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-white/15 disabled:opacity-50"
                disabled={creating}
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto p-5 md:p-6">
              <section className="rounded-[22px] border border-neutral-200 bg-[#faf9f7] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">Información principal</p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-[12px] font-bold text-neutral-800">Nombre *</span>
                    <input value={createState.name} onChange={(event) => setCreateState({ ...createState, name: event.target.value })} className="alento-input w-full rounded-xl px-4 py-3 text-sm" autoFocus />
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-[12px] font-bold text-neutral-800">Descripción</span>
                    <textarea value={createState.description} onChange={(event) => setCreateState({ ...createState, description: event.target.value })} className="alento-input min-h-24 w-full rounded-xl px-4 py-3 text-sm" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-bold text-neutral-800">{createState.categorySlug === "pizzas" ? "Valor del sabor *" : "Precio *"}</span>
                    <input value={createState.basePrice} onChange={(event) => setCreateState({ ...createState, basePrice: event.target.value })} inputMode="numeric" className="alento-input w-full rounded-xl px-4 py-3 text-sm" placeholder={createState.categorySlug === "ingredientes" ? "5000" : ""} />
                  </label>
                  <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">Comportamiento</span>
                    <p className="mt-1 text-[10.5px] leading-4 text-neutral-600">
                      {createState.categorySlug === "pizzas"
                        ? "En el POS se sumará el tamaño Personal (" + formatCOP(minPizzaSizePrice) + ")."
                        : createState.categorySlug === "ingredientes"
                          ? "Se creará como ingrediente adicional, no como producto independiente."
                          : "Producto estándar con precio fijo."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-4 rounded-[22px] border border-neutral-200 bg-white p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">Imágenes del producto</p>
                  <h3 className="mt-1 text-[15px] font-bold text-neutral-900">Carga desde tu dispositivo</h3>
                  <p className="mt-1 text-[10px] text-neutral-500">
                    Se guardarán automáticamente en Alentó después de crear el producto.
                  </p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <PendingProductImageControl
                    label="Imagen principal"
                    file={createImageFiles.MAIN}
                    onChange={(file) =>
                      setCreateImageFiles((current) => ({ ...current, MAIN: file }))
                    }
                  />
                  <PendingProductImageControl
                    label="Imagen secundaria"
                    file={createImageFiles.SECONDARY}
                    onChange={(file) =>
                      setCreateImageFiles((current) => ({ ...current, SECONDARY: file }))
                    }
                  />
                </div>
              </section>

              {createError && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] font-medium text-red-700">{createError}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 bg-[#faf9f7] px-5 py-4">
              <button type="button" onClick={() => setCreateState(null)} disabled={creating} className="h-11 rounded-xl border border-neutral-200 bg-white px-5 text-[12px] font-bold text-neutral-700 disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={creating} className="alento-red-glow h-11 rounded-xl bg-[var(--brand-red)] px-5 text-[12px] font-black text-white disabled:opacity-50">
                {creating ? "Creando..." : "Crear producto"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <ActionConfirmModal
          variant="danger"
          eyebrow="Eliminar producto"
          title={`Eliminar ${deleteTarget.name}`}
          description="Esta acción no se puede deshacer."
          detail="Solo se eliminará si el producto no tiene pedidos registrados ni dependencias activas en combos."
          confirmLabel={deletingProductId === deleteTarget.id ? "Eliminando..." : "Eliminar producto"}
          cancelLabel="Cancelar"
          busy={deletingProductId === deleteTarget.id}
          onClose={() => {
            if (deletingProductId == null) setDeleteTarget(null);
          }}
          onConfirm={() => void deleteProduct(deleteTarget)}
        />
      )}

      {comboState && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingCombo) setComboState(null);
          }}
        >
          <form onSubmit={saveCombo} className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-[0_30px_90px_rgba(0,0,0,.28)]">
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-[var(--brand-red)] bg-[radial-gradient(circle_at_92%_10%,rgba(229,28,17,.22),transparent_32%),linear-gradient(135deg,#09090a,#191617)] px-6 py-4.5 text-white">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Constructor de combo</p>
                <h2 className="mt-1 text-[26px] font-black tracking-[-0.03em] text-white">{comboState.id ? `Configurar ${comboState.name}` : "Crear combo"}</h2>
                <p className="mt-1 text-[11px] text-white/55">Define productos, cantidades, tamaños, sabores y descuento.</p>
              </div>
              <button
                type="button"
                onClick={() => !savingCombo && setComboState(null)}
                className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-white/15 disabled:opacity-50"
                disabled={savingCombo}
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto p-5 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <section className="rounded-[24px] border border-neutral-200 p-4">
                  <h3 className="font-black">Información del combo</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Nombre *</span><input value={comboState.name} onChange={(event) => setComboState({ ...comboState, name: event.target.value })} className="alento-input w-full rounded-2xl px-4 py-3" /></label>
                    <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-bold">Descripción</span><textarea value={comboState.description} onChange={(event) => setComboState({ ...comboState, description: event.target.value })} className="alento-input min-h-20 w-full rounded-2xl px-4 py-3" /></label>
                    <div className="md:col-span-2">
                      <p className="alento-ui-label mb-2 uppercase tracking-[0.08em] text-neutral-500">Imágenes del combo</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {comboState.id ? (
                          <>
                            <ExistingProductImageControl
                              label="Imagen principal"
                              productId={comboState.id}
                              slot="MAIN"
                              url={comboState.imageUrl}
                              busy={imageBusy === `${comboState.id}:MAIN`}
                              onUpload={(productId, slot, file) =>
                                void handleProductImageUpload(productId, slot, file)
                              }
                              onRemove={(productId, slot) =>
                                void handleProductImageRemove(productId, slot)
                              }
                            />
                            <ExistingProductImageControl
                              label="Imagen secundaria"
                              productId={comboState.id}
                              slot="SECONDARY"
                              url={comboState.imageUrl2}
                              busy={imageBusy === `${comboState.id}:SECONDARY`}
                              onUpload={(productId, slot, file) =>
                                void handleProductImageUpload(productId, slot, file)
                              }
                              onRemove={(productId, slot) =>
                                void handleProductImageRemove(productId, slot)
                              }
                            />
                          </>
                        ) : (
                          <>
                            <PendingProductImageControl
                              label="Imagen principal"
                              file={comboImageFiles.MAIN}
                              onChange={(file) =>
                                setComboImageFiles((current) => ({ ...current, MAIN: file }))
                              }
                            />
                            <PendingProductImageControl
                              label="Imagen secundaria"
                              file={comboImageFiles.SECONDARY}
                              onChange={(file) =>
                                setComboImageFiles((current) => ({ ...current, SECONDARY: file }))
                              }
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-neutral-200 bg-[#faf9f7] p-4">
                  <div className="flex items-center justify-between gap-4"><div><h3 className="font-black">Pizza</h3><p className="text-xs text-neutral-500">Cantidad de pizzas, tamaños permitidos y sabores disponibles.</p></div><label className="flex items-center gap-2"><span className="text-xs font-bold">Cantidad</span><input type="number" min="0" max="10" value={comboState.pizzaQuantity} onChange={(event) => setComboState({ ...comboState, pizzaQuantity: Math.max(0, Number(event.target.value) || 0) })} className="alento-input w-20 rounded-xl px-3 py-2" /></label></div>
                  {comboState.pizzaQuantity > 0 && <><p className="mb-2 mt-4 text-xs font-black uppercase tracking-[0.12em] text-neutral-400">Tamaños permitidos</p><div className="flex flex-wrap gap-2">{data?.sizes.map((size) => { const selected = comboState.pizzaSizeIds.includes(size.id); return <button key={size.id} type="button" onClick={() => setComboState({ ...comboState, pizzaSizeIds: toggleId(comboState.pizzaSizeIds, size.id) })} className={`rounded-xl border px-3 py-2 text-sm font-bold ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}>{size.name} · {formatCOP(size.basePrice)}</button>; })}</div><p className="mb-2 mt-4 text-xs font-black uppercase tracking-[0.12em] text-neutral-400">Sabores permitidos</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pizzas.map((pizza) => { const selected = comboState.pizzaFlavorIds.includes(pizza.id); return <button key={pizza.id} type="button" onClick={() => setComboState({ ...comboState, pizzaFlavorIds: toggleId(comboState.pizzaFlavorIds, pizza.id) })} className={`rounded-xl border p-3 text-left ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}><span className="block text-sm font-black">{pizza.name}</span><span className={`mt-1 block text-xs ${selected ? "text-white/55" : "text-neutral-400"}`}>Sabor {formatCOP(pizza.basePrice)}</span></button>; })}</div></>}
                </section>

                <section className="rounded-[24px] border border-neutral-200 bg-[#faf9f7] p-4">
                  <div className="flex items-center justify-between gap-4"><div><h3 className="font-black">Antojo</h3><p className="text-xs text-neutral-500">Opciones permitidas dentro del combo.</p></div><label className="flex items-center gap-2"><span className="text-xs font-bold">Cantidad</span><input type="number" min="0" max="10" value={comboState.snackQuantity} onChange={(event) => setComboState({ ...comboState, snackQuantity: Math.max(0, Number(event.target.value) || 0) })} className="alento-input w-20 rounded-xl px-3 py-2" /></label></div>
                  {comboState.snackQuantity > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{snacks.map((product) => { const selected = comboState.snackProductIds.includes(product.id); return <button key={product.id} type="button" onClick={() => setComboState({ ...comboState, snackProductIds: toggleId(comboState.snackProductIds, product.id) })} className={`rounded-xl border p-3 text-left ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}><span className="block text-sm font-black">{product.name}</span><span className={`mt-1 block text-xs ${selected ? "text-white/55" : "text-neutral-400"}`}>{formatCOP(product.basePrice)}</span></button>; })}</div>}
                </section>

                <section className="rounded-[24px] border border-neutral-200 bg-[#faf9f7] p-4">
                  <div className="flex items-center justify-between gap-4"><div><h3 className="font-black">Bebida</h3><p className="text-xs text-neutral-500">Selecciona las presentaciones que aplican.</p></div><label className="flex items-center gap-2"><span className="text-xs font-bold">Cantidad</span><input type="number" min="0" max="10" value={comboState.beverageQuantity} onChange={(event) => setComboState({ ...comboState, beverageQuantity: Math.max(0, Number(event.target.value) || 0) })} className="alento-input w-20 rounded-xl px-3 py-2" /></label></div>
                  {comboState.beverageQuantity > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{beverages.map((product) => { const selected = comboState.beverageProductIds.includes(product.id); return <button key={product.id} type="button" onClick={() => setComboState({ ...comboState, beverageProductIds: toggleId(comboState.beverageProductIds, product.id) })} className={`rounded-xl border p-3 text-left ${selected ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}><span className="block text-sm font-black">{product.name}</span><span className={`mt-1 block text-xs ${selected ? "text-white/55" : "text-neutral-400"}`}>{formatCOP(product.basePrice)}</span></button>; })}</div>}
                </section>
              </div>

              <aside className="h-fit rounded-[24px] bg-[#111112] p-5 text-white xl:sticky xl:top-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Resumen</p><h3 className="mt-1 text-xl font-black">{comboState.name || "Nuevo combo"}</h3>
                <div className="mt-4 space-y-2 text-sm text-white/65">{comboState.pizzaQuantity > 0 && <p>{comboState.pizzaQuantity} × pizza · {comboState.pizzaSizeIds.length} tamaños · {comboState.pizzaFlavorIds.length} sabores</p>}{comboState.snackQuantity > 0 && <p>{comboState.snackQuantity} × antojo · {comboState.snackProductIds.length} opciones</p>}{comboState.beverageQuantity > 0 && <p>{comboState.beverageQuantity} × bebida · {comboState.beverageProductIds.length} opciones</p>}</div>
                <div className="mt-5 space-y-3 border-t border-white/10 pt-4"><div className="flex justify-between gap-3 text-sm"><span className="text-white/55">Valor normal mínimo</span><strong>{formatCOP(comboPreview.min)}</strong></div><div className="flex justify-between gap-3 text-sm"><span className="text-white/55">Valor normal máximo</span><strong>{formatCOP(comboPreview.max)}</strong></div><label className="block"><span className="text-xs font-bold text-white/55">Descuento del combo</span><input value={comboState.discountAmount} onChange={(event) => setComboState({ ...comboState, discountAmount: event.target.value })} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xl font-black text-white outline-none" placeholder="7800" /></label><div className="rounded-2xl bg-[var(--brand-red)]/15 px-3 py-2.5 text-sm"><div className="flex justify-between"><span className="text-white/70">Descuento fijo</span><strong className="text-red-300">- {formatCOP(comboPreview.discount)}</strong></div></div><div className="border-t border-white/10 pt-3"><div className="flex justify-between"><span className="font-black">Precio combo mínimo</span><strong className="text-xl">{formatCOP(comboPreview.finalMin)}</strong></div><div className="mt-1 flex justify-between"><span className="font-black">Precio combo máximo</span><strong className="text-xl">{formatCOP(comboPreview.finalMax)}</strong></div></div></div>
              </aside>
            </div>

              {comboError && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[11px] font-medium text-red-700">{comboError}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 bg-[#faf9f7] px-5 py-4">
              <button
                type="button"
                onClick={() => setComboState(null)}
                disabled={savingCombo}
                className="h-11 rounded-xl border border-neutral-200 bg-white px-5 text-[12px] font-bold text-neutral-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingCombo}
                className="alento-red-glow h-11 rounded-xl bg-[var(--brand-red)] px-5 text-[12px] font-black text-white disabled:opacity-50"
              >
                {savingCombo ? "Guardando..." : comboState.id ? "Guardar combo" : "Crear combo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
