import { toast } from "react-toastify";

class Notification {
  constructor(message: string, code: number) {
    switch (code) {
      case 0:
        this.error(message);
        break;
      case 1:
        this.success(message);
        break;

      case 2:
        this.info(message);
        break;

      case 3:
        this.warn(message);
        break;

      default:
        break;
    }
  }

  success(message: string) {
    toast.success(message, {
      position: "bottom-left",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "colored",
    });
  }

  error(message: string) {
    toast.error(message, {
      position: "bottom-left",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "colored",
    });
  }

  info(message: string) {
    toast.info(message, {
      position: "bottom-left",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "colored",
    });
  }

  warn(message: string) {
    toast.warn(message, {
      position: "bottom-left",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "colored",
    });
  }
}

// const NotificationContainer = () => {
//     return (
//         <ToastContainer
//             position="top-right"
//             autoClose={5000}
//             hideProgressBar={false}
//             newestOnTop={false}
//             closeOnClick
//             rtl={false}
//             pauseOnFocusLoss
//             draggable
//             pauseOnHover
//             theme="colored"
//         />
//     )
// }

export default Notification;
