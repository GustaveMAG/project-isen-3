const LABELS = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };
const CLASSES = {
  todo:        'badge-todo',
  in_progress: 'badge-progress',
  done:        'badge-done',
};

export default function TaskStatusBadge({ statut }) {
  return <span className={CLASSES[statut] || 'badge-todo'}>{LABELS[statut] || statut}</span>;
}
