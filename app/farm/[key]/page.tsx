import type { Metadata } from "next";
import FarmDashboard from "./farm-dashboard";

export const metadata: Metadata = {
  title: "My farm — Seasonwise",
  robots: { index: false }, // private per-key pages must not be indexed
};

export default async function FarmPage(props: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await props.params;
  return <FarmDashboard farmKey={key} />;
}
