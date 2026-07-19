import { ChamberApp } from "@/components/ChamberApp";

export default async function ChamberPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ChamberApp code={code} />;
}
