import { useRef, useState } from "react";
import { HiOutlineArrowLeft, HiOutlineSearch } from "react-icons/hi";
import { ParamName } from "../../../../../lib/constants/constants";
import { Button, Input } from "../../../../shared/utilities/form";
import { useHomeContext } from "../../provider/home-provider";

export const ProductSearchText = ({ showInput, setShowInput }) => {
  const inputRef = useRef(null);
  const { queryParam, setQueryParam } = useHomeContext();
  const [searchValue, setSearchValue] = useState(queryParam[ParamName.search] || "");

  const handleShowInput = () => {
    setShowInput(true);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  const handleHideInput = () => {
    setShowInput(false);
    setSearchValue("");
    setQueryParam({ ...queryParam, [ParamName.search]: "" });
  };

  const handleInputChange = (e) => {
    if (!e) {
      setQueryParam({ ...queryParam, [ParamName.search]: "" });
    }
    setSearchValue(e);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      setQueryParam({ ...queryParam, [ParamName.search]: searchValue });
    }
  };

  return !showInput ? (
    <Button
      className="flex items-center justify-center w-8 h-8 p-4 border border-gray-400 rounded-full hover:bg-gray-100"
      onClick={handleShowInput}
      aria-label="Tìm kiếm"
      icon={<HiOutlineSearch />}
    />
  ) : (
    <div className="flex items-center w-full gap-2">
      <div className="w-full" onKeyDown={handleInputKeyDown}>
        <Input
          className="w-full py-1 text-sm rounded-full border-primary"
          placeholder="Tìm kiếm sản phẩm..."
          value={searchValue}
          onChange={handleInputChange}
          clearable
          prefix={
            <Button className="w-6 h-6" icon={<HiOutlineArrowLeft />} onClick={handleHideInput} />
          }
          prefixClassName={"w-6 h-7 min-w-6 cursor-pointer font-semibold"}
        />
      </div>
    </div>
  );
};
