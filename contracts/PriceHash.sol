// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
library PriceHash {
    error InvalidSalt();
    /// @notice Exactly 18 Unicode scalar values, including punctuation and emoji.
    /// @dev Validate UTF-8 rather than equating characters with bytes.
    function validate(string memory salt) internal pure {
        bytes memory s=bytes(salt); uint256 count; uint256 i;
        while(i<s.length) {
            uint8 b=uint8(s[i]); uint256 n; uint256 cp;
            if(b<0x80){n=1;cp=b;}
            else if(b>=0xc2 && b<=0xdf){n=2;cp=b & 0x1f;}
            else if(b>=0xe0 && b<=0xef){n=3;cp=b & 0x0f;}
            else if(b>=0xf0 && b<=0xf4){n=4;cp=b & 0x07;}
            else revert InvalidSalt();
            if(i+n>s.length)revert InvalidSalt();
            for(uint256 j=1;j<n;++j){uint8 c=uint8(s[i+j]);if(c<0x80 || c>0xbf)revert InvalidSalt();cp=(cp<<6)|(c & 0x3f);}
            if((n==2 && cp<0x80)||(n==3 && cp<0x800)||(n==4 && cp<0x10000)||cp>0x10ffff||(cp>=0xd800 && cp<=0xdfff))revert InvalidSalt();
            i+=n; ++count;
        }
        if(count!=18)revert InvalidSalt();
    }
    function hash(uint256 price,address account,string memory salt) internal pure returns(bytes32){
        validate(salt);return keccak256(abi.encode(price,account,salt));
    }
}
