import { useParams } from "react-router-dom";
import CardForm from "../components/CardForm";
import { useResource } from "../hooks/useResource";
import { ResourceState } from "../components/CardSummary";
import { type Card } from "../cards";
export function NewCard() {
  return <CardForm />;
}
export function EditCard() {
  const { cardId } = useParams();
  const { data, loading, error, retry } = useResource<Card>("/cards/" + cardId);
  return data ? (
    <CardForm key={data.id} initial={data} />
  ) : (
    <main className="page">
      <ResourceState loading={loading} error={error} retry={retry} />
    </main>
  );
}
