import JournalTrade from "@/components/JournalTrade";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JournalTradePage({
  params,
}: Props) {
  const { id } = await params;

  return <JournalTrade id={id} />;
}
