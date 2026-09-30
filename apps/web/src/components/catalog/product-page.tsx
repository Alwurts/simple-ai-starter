import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ShellHeader,
  ShellHeaderActions,
  ShellHeaderSidebarTrigger,
  ShellPage,
} from "@workspace/ui/components/brand/shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/shadcn/alert-dialog";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/shadcn/card";
import {
  DEFAULT_CURRENCY,
  formatMoneyMinor,
  majorToMinor,
  minorToMajorInput,
} from "@workspace/ui/lib/money";
import { DollarSign, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  ProductForm,
  type ProductFormValues,
} from "@/components/catalog/product-form";
import { AppBreadcrumbs } from "@/components/layout/app-breadcrumbs";
import { ResourceNotFound } from "@/components/layout/resource-not-found";
import {
  useDeleteProduct,
  useProduct,
  useUpdateProduct,
} from "@/hooks/catalog/use-products";
import { INTL_LOCALE } from "@/lib/locale";

interface ProductDetailsReadOnlyProps {
  product: {
    name: string;
    description: string | null;
  };
}

function ProductDetailsReadOnly({ product }: ProductDetailsReadOnlyProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-1 font-medium text-muted-foreground text-sm">
          Description
        </h4>
        <p className="text-foreground/90 text-sm leading-relaxed">
          {product.description || "No description provided."}
        </p>
      </div>
    </div>
  );
}

export function ProductPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { id: productId } = useParams({
    from: "/_protected/_org/catalog/$id",
  });
  const navigate = useNavigate();
  const {
    data: product,
    isPending: isLoadingProduct,
    isError: isProductError,
  } = useProduct(productId || "");
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  if (!productId) {
    return (
      <ShellPage>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <h2 className="font-semibold text-xl">Loading…</h2>
        </div>
      </ShellPage>
    );
  }
  const handleUpdate = async (data: ProductFormValues) => {
    await updateProduct.mutateAsync({
      id: productId,
      data: {
        ...data,
        price: majorToMinor(data.price, DEFAULT_CURRENCY),
      },
    });
    setIsEditing(false);
  };
  const handleDelete = async () => {
    await deleteProduct.mutateAsync(productId);
    navigate({
      to: "/catalog",
    });
  };
  if (isLoadingProduct) {
    return (
      <ShellPage>
        <ShellHeader>
          <ShellHeaderSidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          </div>
        </ShellHeader>
        <div
          aria-busy="true"
          aria-label="Loading…"
          className="p-6"
          role="status"
        >
          <div className="h-64 animate-pulse rounded-lg bg-muted/20" />
        </div>
      </ShellPage>
    );
  }
  if (isProductError || !product) {
    return (
      <ResourceNotFound
        backLabel="Back to Catalog"
        title="Product not found"
        to="/catalog"
      />
    );
  }
  return (
    <ShellPage>
      <ShellHeader>
        <ShellHeaderSidebarTrigger className="-ml-1" />
        <AppBreadcrumbs
          items={[
            {
              title: "Catalog",
              href: "/catalog",
            },
            {
              title: product.name,
            },
          ]}
        />
        <ShellHeaderActions>
          {isEditing ? (
            <Button
              aria-label="Cancel"
              onClick={() => setIsEditing(false)}
              size="sm"
              variant="ghost"
            >
              <X className="size-4" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          ) : (
            <>
              <Button
                aria-label="Edit"
                onClick={() => setIsEditing(true)}
                size="sm"
                variant="outline"
              >
                <Pencil className="size-4" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button
                aria-label="Delete"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                size="sm"
                variant="outline"
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </>
          )}
        </ShellHeaderActions>
      </ShellHeader>

      <div className="space-y-8 overflow-y-auto p-6">
        <div>
          <h2 className="font-semibold text-lg">{product.name}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">Price</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {formatMoneyMinor(product.price ?? 0, DEFAULT_CURRENCY, {
                  locale: INTL_LOCALE,
                })}
              </div>
              <p className="text-muted-foreground text-xs">Per unit</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Basic information and settings.</CardDescription>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <ProductForm
                // Remount when server product fields change (e.g. agent tool
                // invalidation) so RHF defaultValues pick up the fresh query.
                key={[
                  product.id,
                  product.name,
                  product.price,
                  product.description ?? "",
                ].join("|")}
                defaultValues={{
                  name: product.name,
                  price: minorToMajorInput(
                    product.price ?? 0,
                    DEFAULT_CURRENCY
                  ),
                  description: product.description || "",
                }}
                isLoading={updateProduct.isPending}
                mode="edit"
                onSubmit={handleUpdate}
              />
            ) : (
              <ProductDetailsReadOnly product={product} />
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will permanently delete the product ${product.name}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProduct.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProduct.isPending}
              onClick={handleDelete}
            >
              {deleteProduct.isPending ? "Deleting..." : "Delete Product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShellPage>
  );
}
