type props = {
    title: string
}

function Title2({title}: props) {
  return (
    <div>
          <h1 className="text-[15px] font-semibold">{title}</h1>
    </div>
  )
}

export default Title2
