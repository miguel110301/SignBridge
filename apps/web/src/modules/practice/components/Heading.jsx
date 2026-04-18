export default function Heading({ children, as: Tag = 'h2', className = '' }) {
  return (
    <Tag className={`text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl ${className}`}>
      {children}
    </Tag>
  )
}
