
type props = {
    children: React.ReactNode
}

function Text({children}: props) {
  return (
    <div className="flex flex-col items-center justify-center text-sm text-gray-800">
      {children}
    </div>
  )
}

export default Text
