import { NewListingWorkspace } from "@/components/listing/new-listing-workspace";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NewListingWorkspace productId={id} />;
}
