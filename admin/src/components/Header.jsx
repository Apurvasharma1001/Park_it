const Header = ({ title }) => {
  return (
    <div className="bg-white shadow-sm border-b border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
    </div>
  );
};

export default Header;

