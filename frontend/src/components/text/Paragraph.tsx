type props = {
    description: string
}
function Paragraph({description}: props) {
  return (
    <div>
      <p className="max-w-3xl text-[12px] leading-5 text-slate-500 md:text-[13px]">
        {description}
      </p>
    </div>
  )
}

export default Paragraph
