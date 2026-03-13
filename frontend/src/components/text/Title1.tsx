type props = {
    title: string
}

function Title1({title}: props) {
  return (
    <div>
          <h1 className="text-[18px] font-semibold">{title}</h1>
    </div>
  )
}

export default Title1
