export default function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-10 text-center">
      {Icon && (
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-burgundy-50 text-burgundy-600">
          <Icon size={22} />
        </div>
      )}
      {title && <h3 className="text-base font-semibold text-ink-900">{title}</h3>}
      {body && <p className="mt-1 text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
