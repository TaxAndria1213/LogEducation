type props = {
    description: string
}
function Paragraph({description}: props) {
  return (
    <div>
          <p className="text-gray-500 text-[12px]">{description}</p>
    </div>
  )
}

export default Paragraph
