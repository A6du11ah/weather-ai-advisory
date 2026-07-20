import type { Metadata } from "next";
import FieldDetail from "./field-detail";

export const metadata: Metadata = {
  title: "Field — Field Window",
  robots: { index: false },
};

export default async function FieldPage(props: {
  params: Promise<{ key: string; id: string }>;
}) {
  const { key, id } = await props.params;
  return <FieldDetail farmKey={key} fieldId={id} />;
}
