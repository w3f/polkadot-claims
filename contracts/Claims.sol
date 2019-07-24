pragma solidity 0.5.9;

import "./FrozenToken.sol";

/// @author Web3 Foundation
/// @title  Claims
///         Allows allocations to be claimed to Polkadot public keys.
contract Claims is Owned {

    // The maximum number contained by the type `uint`. Used to freeze the contract from claims.
    uint constant public UINT_MAX =  115792089237316195423570985008687907853269984665640564039457584007913129639935;

    struct Claim {
        uint    index;          // Index for short address.
        bytes32 pubKey;         // x25519 public key.
        bool    hasIndex;       // Has the index been set?
        uint    vested;         // Amount of allocation that is vested.
    }

    // The address of the allocation indicator contract.
    FrozenToken public allocationIndicator; // 0xb59f67A8BfF5d8Cd03f6AC17265c550Ed8F33907

    // The next index to be assigned.
    uint public nextIndex;

    // Maps allocations to `Claim` data.
    mapping (address => Claim) public claims;

    // Addresses that already claimed so we can easily grab them from state.
    address[] public claimed;

    // Amended keys, old address => new address. New address is allowed to claim for old address.
    mapping (address => address) public amended;

    // Block number that the set up delay ends.
    uint public endSetUpDelay;

    // Event for when an allocation address amendment is made.
    event Amended(address indexed original, address indexed amendedTo);
    // Event for when an allocation is claimed to a Polkadot address.
    event Claimed(address indexed eth, bytes32 indexed dot, uint indexed idx);
    // Event for when an index is assigned to an allocation.
    event IndexAssigned(address indexed eth, uint indexed idx);
    // Event for when vesting is set on an allocation.
    event Vested(address indexed eth, uint amount);

    constructor(address _owner, address _allocations, uint _setUpDelay) public {
        require(_owner != address(0x0), "Must provide an owner address.");
        require(_allocations != address(0x0), "Must provide an allocations address.");
        require(_setUpDelay > 0, "Must provide a non-zero argument to _setUpDelay.");

        owner = _owner;
        allocationIndicator = FrozenToken(_allocations);
        
        endSetUpDelay = block.number + _setUpDelay;
    }

    /// Allows owner to manually amend allocations to a new address that can claim.
    /// @dev The given arrays must be same length and index must map directly.
    /// @param _origs An array of original (allocation) addresses.
    /// @param _amends An array of the new addresses which can claim those allocations.
    function amend(address[] calldata _origs, address[] calldata _amends)
        external
        only_owner
    {
        require(
            _origs.length == _amends.length,
            "Must submit arrays of equal length."
        );

        for (uint i = 0; i < _amends.length; i++) {
            require(!hasClaimed(_origs[i]), "Address has already claimed.");
            amended[_origs[i]] = _amends[i];
            emit Amended(_origs[i], _amends[i]);
        }
    }

    /// Allows owner to manually toggle vesting onto allocations.
    /// @param _eths The addresses for which to set vesting.
    /// @param _vestingAmts The amounts that the accounts are vested.
    function setVesting(address[] calldata _eths, uint[] calldata _vestingAmts)
        external
        only_owner
    {
        require(_eths.length == _vestingAmts.length, "Must submit arrays of equal length.");

        for (uint i = 0; i < _eths.length; i++) {
            Claim storage claimData = claims[_eths[i]];
            require(!hasClaimed(_eths[i]), "Account must not be claimed.");
            require(claimData.vested == 0, "Account must not be vested already.");
            require(_vestingAmts[i] != 0, "Vesting amount must be greater than zero.");
            claimData.vested = _vestingAmts[i];
            emit Vested(_eths[i], _vestingAmts[i]);
        }
    }

    function increaseVesting(address[] calldata _eths, uint[] calldata _vestingAmts)
        external
        only_owner
    {
        require(_eths.length == _vestingAmts.length, "Must submit arrays of equal length.");

        for (uint i = 0; i < _eths.length; i++) {
            Claim storage claimData = claims[_eths[i]];
            // Does not require that the allocation is unclaimed.
            // Does not require that vesting has already been set.
            require(_vestingAmts[i] > 0, "Vesting amount must be greater than zero.");
            uint oldVesting = claimData.vested;
            uint newVesting = oldVesting + _vestingAmts[i];
            // Check for overflow.
            require(newVesting > oldVesting, "Overflow in addition.");
            claimData.vested = newVesting;
            emit Vested(_eths[i], _vestingAmts[i]);
        }
    }

    /// Freezes the contract from any further claims.
    /// @dev Protected by the `only_owner` modifier.
    function freeze() external only_owner {
        endSetUpDelay = UINT_MAX;
    }

    /// Allows anyone to assign a batch of indices onto unassigned and unclaimed allocations.
    /// @dev This function is safe because all the necessary checks are made on `assignNextIndex`.
    /// @param _eths An array of allocation addresses to assign indices for.
    /// @return bool True is successful.
    function assignIndices(address[] calldata _eths)
        external
        protected_during_delay
    {
        for (uint i = 0; i < _eths.length; i++) {
            require(assignNextIndex(_eths[i]), "Assigning the next index failed.");
        }
    }

    /// Claims an allocation associated with an `_eth` address to a `_pubKey` public key.
    /// @dev Can only be called by the `_eth` address or the amended address for the allocation.
    /// @param _eth The allocation address to claim.
    /// @param _pubKey The Polkadot public key to claim.
    /// @return True if successful.
    function claim(address _eth, bytes32 _pubKey)
        external
        after_set_up_delay
        has_allocation(_eth)
        not_claimed(_eth)
    {
        require(_pubKey != bytes32(0), "Failed to provide an Ed25519 or SR25519 public key.");
        
        if (amended[_eth] != address(0x0)) {
            require(amended[_eth] == msg.sender, "Address is amended and sender is not the amendment.");
        } else {
            require(_eth == msg.sender, "Sender is not the allocation address.");
        }

        if (claims[_eth].index == 0 && !claims[_eth].hasIndex) {
            require(assignNextIndex(_eth), "Assigning the next index failed.");
        }

        claims[_eth].pubKey = _pubKey;
        claimed.push(_eth);

        emit Claimed(_eth, _pubKey, claims[_eth].index);
    }

    /// Get the length of `claimed`.
    /// @return uint The number of accounts that have claimed.
    function claimedLength()
        external view returns (uint)
    {   
        return claimed.length;
    }

    /// Get whether an allocation has been claimed.
    /// @return bool True if claimed.
    function hasClaimed(address _eth)
        public view returns (bool)
    {
        return claims[_eth].pubKey != bytes32(0);
    }

    /// Assings an index to an allocation address.
    /// @dev Public function.
    /// @param _eth The allocation address.
    function assignNextIndex(address _eth)
        has_allocation(_eth)
        not_claimed(_eth)
        internal returns (bool)
    {
        require(claims[_eth].index == 0, "Cannot reassign an index.");
        require(!claims[_eth].hasIndex, "Address has already been assigned an index.");
        uint idx = nextIndex;
        nextIndex++;
        claims[_eth].index = idx;
        claims[_eth].hasIndex = true;
        emit IndexAssigned(_eth, idx);
        return true;
    }

    /// @dev Requires that `_eth` address has DOT allocation.
    modifier has_allocation(address _eth) {
        uint bal = allocationIndicator.balanceOf(_eth);
        require(
            bal > 0,
            "Ethereum address has no DOT allocation."
        );
        _;
    }

    /// @dev Requires that `_eth` address has not claimed.
    modifier not_claimed(address _eth) {
        require(
            claims[_eth].pubKey == bytes32(0),
            "Account has already claimed."
        );
        _;
    }

    /// @dev Requires that the function with this modifier is evoked after `endSetUpDelay`.
    modifier after_set_up_delay {
        require(
            block.number >= endSetUpDelay,
            "This function is only evocable after the setUpDelay has elapsed."
        );
        _;
    }

    /// @dev Requires that the function with this modifier is evoked only by owner before `endSetUpDelay`.
    modifier protected_during_delay {
        if (block.number < endSetUpDelay) {
            require(
                msg.sender == owner,
                "Only owner is allowed to call this function before the end of the set up delay."
            );
        }
        _;
    }
}
