import { db } from "@/lib/db";
import { ingredients } from "@/lib/db/schema";
import { count, ilike, or, asc, desc } from "drizzle-orm";
import { Pill, Plus } from "lucide-react";
import IngredientsClient from "./IngredientsClient";

export const dynamic = "force-dynamic";

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const page = parseInt(params.page || "1");
  const perPage = 50;
  const offset = (page - 1) * perPage;

  let ingredientList: any[] = [];
  let totalCount = 0;

  try {
    const where = query.length >= 2
      ? or(
          ilike(ingredients.name, `%${query}%`),
          ilike(ingredients.rmId, `%${query}%`),
          ilike(ingredients.category, `%${query}%`),
          ilike(ingredients.supplierName, `%${query}%`)
        )
      : undefined;

    ingredientList = await db
      .select()
      .from(ingredients)
      .where(where)
      .orderBy(asc(ingredients.rmId))
      .limit(perPage)
      .offset(offset);

    const [c] = await db.select({ value: count() }).from(ingredients).where(where);
    totalCount = c.value;
  } catch {}

  return (
    <IngredientsClient
      ingredients={ingredientList}
      totalCount={totalCount}
      currentPage={page}
      perPage={perPage}
      query={query}
    />
  );
}
