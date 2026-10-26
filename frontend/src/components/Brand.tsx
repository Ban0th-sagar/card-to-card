import { Link } from "react-router-dom";
import { Route as RouteIcon } from "lucide-react";
export default function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-icon">
        <RouteIcon size={23} />
      </span>
      CARDROUTE<span className="brand-dot">.</span>
    </Link>
  );
}
