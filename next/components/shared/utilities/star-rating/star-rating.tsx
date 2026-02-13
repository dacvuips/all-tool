import { useEffect, useState } from "react";
import { StarRatingDiv } from "./star-rating-style";

export default function StarRating({
  defaultValue,
  onChange,
  value,
  className,
  disabled,
  quantity = 5,
}: {
  onChange?: (value: any) => void;
  defaultValue?: any;
  value?: any;
  className?: string;
  disabled?: boolean;
  quantity?: number;
}) {
  const [rating, setRating] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    defaultValue && setRating(defaultValue);
  }, [defaultValue]);

  return (
    <StarRatingDiv>
      {[...Array(quantity)].map((Star, i) => {
        const ratingValue = i + 1;
        return (
          <label key={i}>
            <input
              type="radio"
              name="rating"
              value={ratingValue}
              onClick={() => {
                !disabled && setRating(ratingValue);
              }}
              onChange={(value) => {
                !disabled && onChange(value.target.value);
              }}
            />
            <i
              onMouseEnter={() => !disabled && setHover(ratingValue)}
              onMouseLeave={() => !disabled && setHover(null)}
              className={` ${className} ${
                ratingValue <= (hover || rating) ? "activeStar " : "star"
              }  w-5 h-5 `}
            ></i>
          </label>
        );
      })}
    </StarRatingDiv>
  );
}
