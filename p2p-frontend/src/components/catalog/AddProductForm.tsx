import { useForm } from "react-hook-form";
import { useAddProduct } from "../../hooks/useCatalog";
import { Button } from "../ui/Button";
import type { Product } from "../../types";

type FormValues = {
  sku: string;
  name: string;
  category: string;
  uom: string;
  description: string;
  referencePrice: number;
};

const inputClass =
  "w-full rounded-md border border-border bg-overlay/[0.03] px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25";

export function AddProductForm({ onDone }: { onDone: () => void }) {
  const addProduct = useAddProduct();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>();

  function onSubmit(values: FormValues) {
    const product: Omit<Product, "id" | "createdAt" | "status"> = {
      sku: values.sku.trim(),
      name: values.name.trim(),
      category: values.category.trim(),
      uom: values.uom.trim(),
      description: values.description.trim(),
      referencePrice: Number(values.referencePrice),
    };
    addProduct.mutate(product, { onSuccess: onDone });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">SKU</label>
          <input {...register("sku", { required: true })} placeholder="FRN-CHR-001" className={inputClass} />
          {errors.sku && <p className="mt-1 text-[11px] text-danger">SKU is required</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">Unit of measure</label>
          <input {...register("uom", { required: true })} placeholder="each" className={inputClass} />
          {errors.uom && <p className="mt-1 text-[11px] text-danger">Required</p>}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] text-text-faint">Product name</label>
        <input
          {...register("name", { required: true })}
          placeholder="Ergonomic Office Chair"
          className={inputClass}
        />
        {errors.name && <p className="mt-1 text-[11px] text-danger">Name is required</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">Category</label>
          <input {...register("category", { required: true })} placeholder="Furniture" className={inputClass} />
          {errors.category && <p className="mt-1 text-[11px] text-danger">Required</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">Reference price ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("referencePrice", { required: true, min: 0, valueAsNumber: true })}
            placeholder="370"
            className={inputClass}
          />
          {errors.referencePrice && <p className="mt-1 text-[11px] text-danger">Required, min 0</p>}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] text-text-faint">Description</label>
        <textarea
          {...register("description")}
          rows={2}
          placeholder="Short description…"
          className={inputClass + " resize-none"}
        />
      </div>

      {addProduct.isError && (
        <p className="text-[11px] text-danger">Couldn't add product. Try again.</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={addProduct.isPending}>
          {addProduct.isPending ? "Adding…" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
