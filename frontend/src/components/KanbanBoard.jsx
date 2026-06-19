import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import { format, isPast, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const COLUMNS = [
  {
    id: 'todo',
    label: 'À faire',
    color: 'bg-gray-100',
    header: 'bg-gray-200 text-gray-700',
    dot: 'bg-gray-400',
    count_color: 'bg-gray-300 text-gray-700',
  },
  {
    id: 'in_progress',
    label: 'En cours',
    color: 'bg-blue-50',
    header: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
    count_color: 'bg-blue-200 text-blue-700',
  },
  {
    id: 'done',
    label: 'Terminé',
    color: 'bg-green-50',
    header: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
    count_color: 'bg-green-200 text-green-700',
  },
];

export default function KanbanBoard({ tasks, projectId, onStatusChange, onDelete, userId, isEncadrant, canChangeStatus = true }) {

  /* Grouper les tâches par statut */
  const columns = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.statut === col.id),
  }));

  /* Gestion du drop */
  const handleDragEnd = (result) => {
    if (!canChangeStatus) return; // jury / projet clôturé : lecture seule
    const { destination, source, draggableId } = result;

    // Ignoré si pas de destination ou même position
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatut = destination.droppableId;
    const taskId    = parseInt(draggableId, 10);

    // Appel optimiste (le parent met à jour l'état immédiatement)
    onStatusChange(taskId, newStatut);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {columns.map((col) => (
          <div key={col.id} className="flex flex-col rounded-xl overflow-hidden border border-gray-200">

            {/* En-tête colonne */}
            <div className={`flex items-center justify-between px-4 py-3 ${col.header}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="font-semibold text-sm">{col.label}</span>
              </div>
              <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${col.count_color}`}>
                {col.tasks.length}
              </span>
            </div>

            {/* Zone droppable */}
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex flex-col gap-2 p-2 min-h-[200px] transition-colors ${
                    snapshot.isDraggingOver ? `${col.color} ring-2 ring-inset ring-purple-300` : 'bg-gray-50'
                  }`}
                >
                  {col.tasks.map((task, index) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      index={index}
                      projectId={projectId}
                      userId={userId}
                      isEncadrant={isEncadrant}
                      canDrag={canChangeStatus}
                      onDelete={onDelete}
                    />
                  ))}
                  {provided.placeholder}

                  {/* Message si colonne vide */}
                  {col.tasks.length === 0 && !snapshot.isDraggingOver && (
                    <div className="flex-1 flex items-center justify-center py-8 text-gray-300 text-xs">
                      Déposer ici
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}

/* Carte tâche draggable */
function KanbanCard({ task, index, projectId, userId, isEncadrant, canDrag = true, onDelete }) {
  const isLate = task.deadline && isPast(parseISO(task.deadline)) && task.statut !== 'done';
  // isEncadrant reçoit canManageTasks (encadrant OU team_leader)
  const canEdit = isEncadrant;

  return (
    <Draggable draggableId={String(task.id)} index={index} isDragDisabled={!canDrag}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg border p-3 shadow-sm select-none transition-shadow ${
            snapshot.isDragging
              ? 'shadow-lg border-purple-400 rotate-1 ring-2 ring-purple-300'
              : isLate
              ? 'border-red-200'
              : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
          }`}
        >
          {/* Header: Priorité + Indicateur retard */}
          <div className="flex items-center justify-between gap-2 mb-2">
            {/* Badge priorité */}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
              task.priorite === 'urgente' ? 'bg-red-100 text-red-700' :
              task.priorite === 'haute'   ? 'bg-orange-100 text-orange-700' :
              task.priorite === 'normale' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {task.priorite === 'urgente' ? 'Urgente' :
               task.priorite === 'haute'   ? 'Haute' :
               task.priorite === 'normale' ? 'Normale' :
               'Basse'}
            </span>

            {/* Indicateur retard */}
            {isLate && (
              <div className="flex items-center gap-1 text-xs text-red-500 font-medium">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                En retard
              </div>
            )}
          </div>

          {/* Titre */}
          <Link
            to={`/projects/${projectId}/tasks/${task.id}`}
            className="block text-sm font-semibold text-gray-800 hover:text-purple-700 transition-colors leading-snug mb-2"
            onClick={(e) => snapshot.isDragging && e.preventDefault()}
          >
            {task.titre}
          </Link>

          {/* Description courte */}
          {task.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mb-2">{task.description}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              {/* Avatar assigné */}
              {task.assignee_nom ? (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {task.assignee_nom.charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}

              {/* Deadline */}
              {task.deadline && (
                <span className={`text-xs truncate ${isLate ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                  {format(parseISO(task.deadline), 'dd MMM', { locale: fr })}
                </span>
              )}
            </div>

            {/* Icône drag */}
            <div className="flex items-center gap-1 text-gray-200 flex-shrink-0">
              {canEdit && (
                <button
                  onClick={(e) => { e.preventDefault(); onDelete(task.id, task.titre); }}
                  className="text-gray-200 hover:text-red-400 transition-colors"
                  title="Supprimer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              {canDrag && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm8-16a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z"/>
                </svg>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
