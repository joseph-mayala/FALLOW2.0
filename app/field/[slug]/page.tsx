import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Plate from "@/components/plate/Plate";
import BlockView from "@/components/plate/BlockView";
import { BlockArt, Block3DView, FlatSoil } from "@/components/plate/BlockFigure";
import FieldShell from "@/components/FieldShell";
import Sidebar from "@/components/side/Sidebar";
import { getLocation, LOCATIONS } from "@/lib/locations";

export function generateStaticParams() {
  return LOCATIONS.map((l) => ({ slug: l.slug }));
}
export const dynamicParams = false;

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const loc = getLocation(params.slug);
  return { title: loc ? `${loc.name} field profile` : "Field profile" };
}

export default function FieldPage({ params }: { params: { slug: string } }) {
  const loc = getLocation(params.slug);
  if (!loc) notFound();
  const site = loc.slug;
  return (
    <FieldShell
      site={site}
      plate={<Plate site={site} view={<BlockView three={<Block3DView site={site} />} art={<BlockArt site={site} />} flat={<FlatSoil site={site} />} />} />}
      sidebar={<Sidebar site={site} />}
    />
  );
}
