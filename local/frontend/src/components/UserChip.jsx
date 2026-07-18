import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar.jsx';

export default function UserChip({ id, name, url, size = 28 }) {
  const navigate = useNavigate();
  if (!name) return null;
  return (
    <span className="user-chip" onClick={() => id && navigate(`/profile/${id}`)}>
      <Avatar name={name} url={url} size={size} />
      <span className="chip-name">{name}</span>
    </span>
  );
}
