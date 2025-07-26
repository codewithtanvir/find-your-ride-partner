import { useNavigate } from "react-router-dom";

export function useRedirect() {
  const navigate = useNavigate();

  return (path) => {
    navigate(path, { replace: true });
  };
}
