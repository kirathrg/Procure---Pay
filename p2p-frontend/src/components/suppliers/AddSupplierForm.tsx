import { useForm } from "react-hook-form";
import { useAddSupplier } from "../../hooks/useSuppliers";
import { Button } from "../ui/Button";
import type { Supplier } from "../../types";

type FormValues = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  category: string;
  taxId: string;
  status: Supplier["status"];
};

const inputClass =
  "w-full rounded-md border border-border bg-overlay/[0.03] px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25";

export function AddSupplierForm({ onDone }: { onDone: () => void }) {
  const addSupplier = useAddSupplier();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { status: "active" } });

  function onSubmit(values: FormValues) {
    addSupplier.mutate(
      {
        name: values.name.trim(),
        contactName: values.contactName.trim(),
        contactEmail: values.contactEmail.trim(),
        contactPhone: values.contactPhone.trim(),
        addressLine: values.addressLine.trim(),
        category: values.category.trim(),
        taxId: values.taxId.trim(),
        status: values.status,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
      <div>
        <label className="mb-1.5 block text-[12px] text-text-faint">Supplier name</label>
        <input {...register("name", { required: true })} placeholder="Acme Supply Co." className={inputClass} />
        {errors.name && <p className="mt-1 text-[11px] text-danger">Name is required</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">Contact name</label>
          <input {...register("contactName", { required: true })} placeholder="Jane Doe" className={inputClass} />
          {errors.contactName && <p className="mt-1 text-[11px] text-danger">Required</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">Contact email</label>
          <input
            type="email"
            {...register("contactEmail", { required: true, pattern: /^\S+@\S+\.\S+$/ })}
            placeholder="jane@acme.example"
            className={inputClass}
          />
          {errors.contactEmail && <p className="mt-1 text-[11px] text-danger">Valid email required</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">Contact phone</label>
          <input {...register("contactPhone")} placeholder="+91 44 0000 0000" className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">Category</label>
          <input {...register("category", { required: true })} placeholder="Furniture" className={inputClass} />
          {errors.category && <p className="mt-1 text-[11px] text-danger">Required</p>}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] text-text-faint">Address</label>
        <input {...register("addressLine")} placeholder="Street, City, State, Country" className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">Tax ID</label>
          <input {...register("taxId")} placeholder="33AAECM1234F1Z5" className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] text-text-faint">Status</label>
          <select {...register("status")} className={inputClass}>
            <option value="active">Active</option>
            <option value="preferred">Preferred</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {addSupplier.isError && (
        <p className="text-[11px] text-danger">Couldn't add supplier. Try again.</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={addSupplier.isPending}>
          {addSupplier.isPending ? "Adding…" : "Add supplier"}
        </Button>
      </div>
    </form>
  );
}
